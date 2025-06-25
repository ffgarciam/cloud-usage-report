import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const region = process.env.AWS_REGION;
const lambdaClient = new LambdaClient({ region });
const snsClient = new SNSClient({ region });

const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN!;
const TARGET_LAMBDA_ARN = process.env.TARGET_LAMBDA_ARN!;

interface NotificationInput {
    clientId: string;
    processedFiles: string[];
    totalRecords: number;
    processingTime: number;
    destinationPath: string;
}

export const handler = async (event: NotificationInput): Promise<void> => {
    console.log('Sending notifications for client:', event.clientId);

    try {
    // Invoke the target Lambda function
        const lambdaCommand = new InvokeCommand({
            FunctionName: TARGET_LAMBDA_ARN,
            InvocationType: 'Event', // Asynchronous invocation
            Payload: JSON.stringify({
                source: 'cur-processor',
                clientId: event.clientId,
                data: event,
            }),
        });

        await lambdaClient.send(lambdaCommand);
        console.log('Successfully invoked target Lambda function');

        // Send SNS notification
        const message = `
            CUR Processing Completed

            Client ID: ${event.clientId}
            Files Processed: ${event.processedFiles.length}
            Total Records: ${event.totalRecords.toLocaleString()}
            Processing Time: ${(event.processingTime / 1000).toFixed(2)} seconds
            Destination: ${event.destinationPath}

            Processed Files:
            ${event.processedFiles.map(f => `- ${f}`).join('\n')}
        `.trim();

        const snsCommand = new PublishCommand({
            TopicArn: SNS_TOPIC_ARN,
            Subject: `CUR Processing Complete - ${event.clientId}`,
            Message: message,
            MessageAttributes: {
                clientId: {
                    DataType: 'String',
                    StringValue: event.clientId,
                },
                processingStatus: {
                    DataType: 'String',
                    StringValue: 'SUCCESS',
                },
            },
        });

        await snsClient.send(snsCommand);
        console.log('Successfully sent SNS notification');

    } catch (error) {
        console.error('Error sending notifications:', error);
        throw error;
    }
};