import { Duration } from "aws-cdk-lib";
import { Alarm, Dashboard, GraphWidget, Metric, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { IStateMachine } from "aws-cdk-lib/aws-stepfunctions";
import { Construct } from "constructs";

export interface CurDashboardLogsProps {
    environment: string;
    processingStateMachine: IStateMachine;
    streamProcessorLambda: IFunction;
    processCurLambda: IFunction;
}

export class CurDashboardLogs extends Construct {
    constructor(scope: Construct, id: string, props: CurDashboardLogsProps) {
        super(scope, id);

        const dashboard = new Dashboard(this, 'CurProcessingDashboard', {
            dashboardName: `cur-processing-${props.environment}`,
        });

        const { streamProcessorLambda, processCurLambda, processingStateMachine } = props;

        dashboard.addWidgets(
            new GraphWidget({
                title: 'Lambda Function Metrics',
                left: [
                    streamProcessorLambda.metricInvocations(),
                    processCurLambda.metricInvocations(),
                ],
                right: [
                    streamProcessorLambda.metricErrors(),
                    processCurLambda.metricErrors(),
                ],
            }),
            new GraphWidget({
                title: 'State Machine Executions',
                left: [
                    processingStateMachine.metricStarted(),
                    processingStateMachine.metricSucceeded(),
                ],
                right: [
                    processingStateMachine.metricFailed(),
                    processingStateMachine.metricTimedOut(),
                ],
            })
        );

        // CloudWatch Alarms
        new Alarm(this, 'ProcessingFailureAlarm', {
            metric: processingStateMachine.metricFailed(),
            threshold: 5,
            evaluationPeriods: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            alarmDescription: 'CUR processing failures exceeded threshold',
        });

        new Alarm(this, 'HighCostAlarm', {
            metric: new Metric({
                namespace: 'AWS/Billing',
                metricName: 'EstimatedCharges',
                dimensionsMap: {
                    Currency: 'USD',
                },
                statistic: 'Maximum',
                period: Duration.days(1),
            }),
            threshold: 100, // Adjust based on expected costs
            evaluationPeriods: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            alarmDescription: 'Estimated charges exceeded threshold',
        });
    }   
}