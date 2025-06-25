import { Duration } from "aws-cdk-lib";
import { ITable } from "aws-cdk-lib/aws-dynamodb";
import { IRole, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { IKey } from "aws-cdk-lib/aws-kms";
import { Architecture, Code, Function, IFunction, Runtime, StartingPosition, Tracing } from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { ITopic } from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import path from "path";

export interface LambdasConstructProps {
    environment: string;
    clientConfigTable: ITable;
    curBucket: IBucket;
    encryptionKey: IKey;
    notificationTopic: ITopic;
    notificationLambdaArn: string;
}

export class LambdasConstruct extends Construct {
    readonly streamProcessorLambda: Function;
    readonly assumeRoleLambda: IFunction;
    readonly processCurLambda: IFunction;
    readonly notificationLambda: IFunction;

    constructor(scope: Construct, id: string, props: LambdasConstructProps) {
        super(scope, id);

        const lambdaRole = this.createLambdaRole();
        this.streamProcessorLambda = this.createStreamProcessorLambda(props, lambdaRole);
        this.assumeRoleLambda = this.createAssumeRoleLambda(props, lambdaRole);
        this.processCurLambda = this.createProcessCurLambda(props, lambdaRole);
        this.notificationLambda = this.createNotificationLambda(props, lambdaRole);
    }


    private createLambdaRole(): IRole {
        return new Role(this, 'LambdaExecutionRole', {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
            ],
        });
    }

    private createStreamProcessorLambda(props: LambdasConstructProps, role: IRole): Function {
        const streamLambda =  new Function(this, 'StreamProcessorLambda', {
            runtime: Runtime.NODEJS_22_X,
            handler: 'streamProcessor.handler',
            code: Code.fromAsset(path.join(__dirname, 'lambda/functions')),
            functionName: `cur-stream-processor-${props.environment}`,
            architecture: Architecture.ARM_64, // Cost optimization
            memorySize: 256,
            timeout: Duration.seconds(30),
            environment: {
                STATE_MACHINE_ARN: '', // Will be set after state machine creation
                ENVIRONMENT: props.environment,
            },
            role: role,
            tracing: Tracing.ACTIVE,
            logRetention: RetentionDays.ONE_MONTH,
        });

        streamLambda.addEventSource(
            new DynamoEventSource(props.clientConfigTable, {
                startingPosition: StartingPosition.LATEST,
                batchSize: 10,
                maxBatchingWindow: Duration.seconds(5),
                bisectBatchOnError: true,
                retryAttempts: 3
            })
        )

        return streamLambda;
    }

    private createAssumeRoleLambda(props: LambdasConstructProps, role: IRole): IFunction {
        const assumeRoleLambda = new Function(this, 'AssumeRoleLambda', {
            runtime: Runtime.NODEJS_22_X,
            handler: 'assumeRole.handler',
            code: Code.fromAsset(path.join(__dirname, 'lambda/functions')),
            functionName: `cur-assume-role-${props.environment}`,
            architecture: Architecture.ARM_64, // Cost optimization
            memorySize: 256,
            timeout: Duration.seconds(60),
            environment: {
                ENVIRONMENT: props.environment,
            },
            role: role,
            tracing: Tracing.ACTIVE,
            logRetention: RetentionDays.ONE_WEEK,
        });

        // Grant STS assume role permissions
        assumeRoleLambda.addToRolePolicy(
            new PolicyStatement({
                actions: ['sts:AssumeRole'],
                resources: ['arn:aws:iam::*:role/CURProcessorCrossAccountRole-*'],
            })
        );

        return assumeRoleLambda;
    }

    private createProcessCurLambda(props: LambdasConstructProps, role: IRole): IFunction {
        const processCurLambda =  new Function(this, 'ProcessCurLambda', {
            runtime: Runtime.NODEJS_22_X,
            handler: 'processCur.handler',
            code: Code.fromAsset(path.join(__dirname, 'lambda/functions')),
            functionName: `cur-process-cur-${props.environment}`,
            architecture: Architecture.ARM_64, // Cost optimization
            memorySize: 1024, // if there are large files, this can be increased
            timeout: Duration.minutes(15),
            environment: {
                DESTINATION_BUCKET: props.curBucket.bucketName,
                ENCRYPTION_KEY_ID: props.encryptionKey.keyId,
                ENVIRONMENT: props.environment,
            },
            role: role,
            tracing: Tracing.ACTIVE,
            logRetention: RetentionDays.ONE_WEEK,
            reservedConcurrentExecutions: 10, // cost control
        });

        processCurLambda.addToRolePolicy(
            new PolicyStatement({
                actions: [
                    's3:ListMultipartUploadParts',
                    's3:AbortMultipartUpload',
                    's3:CreateMultipartUpload',
                    's3:UploadPart',
                    's3:CompleteMultipartUpload'
                ],
                resources: [`${props.curBucket.bucketArn}/*`],
            })
        );

        props.encryptionKey.grantEncryptDecrypt(processCurLambda);

        return processCurLambda;
    }

    private createNotificationLambda(props: LambdasConstructProps, role: IRole): IFunction {
        const notificationLambda = new Function(this, 'NotificationLambda', {
            runtime: Runtime.NODEJS_22_X,
            handler: 'notification.handler',
            code: Code.fromAsset(path.join(__dirname, 'lambda/functions')),
            functionName: `cur-notification-${props.environment}`,
            architecture: Architecture.ARM_64, // Cost optimization
            memorySize: 256,
            timeout: Duration.seconds(30),
            environment: {
                SNS_TOPIC_ARN: props.notificationTopic.topicArn,
                TARGET_LAMBDA_ARN: props.notificationLambdaArn,
                ENVIRONMENT: props.environment,
            },
            role: role,
            tracing: Tracing.ACTIVE,
            logRetention: RetentionDays.ONE_WEEK,
        });

        props.notificationTopic.grantPublish(notificationLambda);
        notificationLambda.addToRolePolicy(
            new PolicyStatement({
                actions: ['lambda:InvokeFunction'],
                resources: [props.notificationLambdaArn],
            })
        );

        return notificationLambda;
    }
}