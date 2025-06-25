import { Construct } from "constructs";
import { LambdasConstruct } from "./lambdas-construct";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { IKey } from "aws-cdk-lib/aws-kms";
import { ITopic } from "aws-cdk-lib/aws-sns";
import { ITable } from "aws-cdk-lib/aws-dynamodb";
import { LambdaInvoke, SnsPublish } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { IStateMachine, LogLevel, Parallel, StateMachine, StateMachineType, TaskInput } from "aws-cdk-lib/aws-stepfunctions";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";

export interface CurWorkflowProps {
    environment: string;
    clientConfigTable: ITable;
    curBucket: IBucket;
    encryptionKey: IKey;
    notificationTopic: ITopic;
    notificationLambdaArn: string;
}

export interface WorkflowTasks {
    validateInputTask: LambdaInvoke;
    assumeRoleTask: LambdaInvoke;
    processCurTask: LambdaInvoke;
    parallelNotification: Parallel;
}

export class CurWorkflow extends Construct {
    readonly processingStateMachine: IStateMachine;

    constructor(scope: Construct, id: string, props: CurWorkflowProps) {
        super(scope, id);

        const lambdas = new LambdasConstruct(this, 'LambdasConstruct', {
            environment: props.environment,
            clientConfigTable: props.clientConfigTable,
            curBucket: props.curBucket,
            encryptionKey: props.encryptionKey,
            notificationTopic: props.notificationTopic,
            notificationLambdaArn: props.notificationLambdaArn,
        });

        const workflowTasks = this.createWorkflowTasks(lambdas, props);
        this.processingStateMachine = this.createStateMachine(workflowTasks, props, lambdas);
    }

    private createWorkflowTasks(lambdas: LambdasConstruct, props: CurWorkflowProps): WorkflowTasks {
        const { streamProcessorLambda, assumeRoleLambda, processCurLambda, notificationLambda } = lambdas;

        const validateInputTask = new LambdaInvoke(this, 'ValidateInput', {
            lambdaFunction: streamProcessorLambda,
            outputPath: '$.Payload',
            retryOnServiceExceptions: true,
        });

        const assumeRoleTask = new LambdaInvoke(this, 'AssumeRole', {
            lambdaFunction: assumeRoleLambda,
            outputPath: '$.Payload',
            retryOnServiceExceptions: true,
        });
        assumeRoleTask.addRetry({
            errors: ['AccessDenied'],
            maxAttempts: 3,
            backoffRate: 2,
        });

        const processCurTask = new LambdaInvoke(this, 'ProcessCUR', {
            lambdaFunction: processCurLambda,
            outputPath: '$.Payload',
            retryOnServiceExceptions: true,
        });
        processCurTask.addRetry({
            errors: ['States.TaskFailed'],
            maxAttempts: 2,
            backoffRate: 2,
        });

        const notifyLambdaTask = new LambdaInvoke(this, 'NotifyLambda', {
            lambdaFunction: notificationLambda,
            inputPath: '$',
            payloadResponseOnly: true,
        });

        const notifyEmailTask = new SnsPublish(this, 'NotifyEmail', {
            topic: props.notificationTopic,
            message: TaskInput.fromJsonPathAt('$.message'),
        });

        const parallelNotification = new Parallel(this, 'ParallelNotification');
        parallelNotification.branch(notifyLambdaTask);
        parallelNotification.branch(notifyEmailTask);

        return {
            validateInputTask,
            assumeRoleTask,
            processCurTask,
            parallelNotification
        }
    }

    private createStateMachine(workflowTasks: WorkflowTasks, props: CurWorkflowProps, lambdas: LambdasConstruct): IStateMachine {
        const { validateInputTask, assumeRoleTask, processCurTask, parallelNotification } = workflowTasks;
        
        const definition = validateInputTask
            .next(assumeRoleTask)
            .next(processCurTask)
            .next(parallelNotification);
        
        const processingStateMachine = new StateMachine(this, 'CurProcessingStateMachine', {
            stateMachineName: `cur-processing-${props.environment}`,
            definition,
            stateMachineType: StateMachineType.STANDARD,
            tracingEnabled: true,
            logs: {
                destination: new LogGroup(this, 'StateMachineLogGroup', {
                    retention: RetentionDays.ONE_MONTH,
                }),
                level: LogLevel.ERROR,
            },
        });

        lambdas.streamProcessorLambda.addEnvironment('STATE_MACHINE_ARN', processingStateMachine.stateMachineArn);
        processingStateMachine.grantStartExecution(lambdas.streamProcessorLambda);

        return processingStateMachine;
    }
}