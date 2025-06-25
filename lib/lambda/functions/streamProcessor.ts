import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';

const region = process.env.AWS_REGION;
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN!;
const client = new SFNClient({ region })

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
    console.log('Processing DynamoDB stream event:', JSON.stringify(event, null, 2));

    for (const record of event.Records) {
        if (record.eventName === 'INSERT') {
            await processNewClient(record);
        }
    }
};

async function processNewClient(record: DynamoDBRecord): Promise<void> {
    try {
        const newImage = record.dynamodb?.NewImage;
            if (!newImage) {
                console.error('No new image found in record');
            return;
        }

        const clientConfig = {
            clientId: newImage.clientId?.S,
            accountId: newImage.accountId?.S,
            roleArn: newImage.roleArn?.S,
            externalId: newImage.externalId?.S,
            curBucketName: newImage.curBucketName?.S,
            curPrefix: newImage.curPrefix?.S,
            notificationEmail: newImage.notificationEmail?.S,
        };

        // Validate required fields
        const requiredFields = ['clientId', 'accountId', 'roleArn', 'externalId', 'curBucketName'];
        for (const field of requiredFields) {
            if (!clientConfig[field as keyof typeof clientConfig]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Start Step Functions execution
        const params = {
            stateMachineArn: STATE_MACHINE_ARN,
            name: `cur-processing-${clientConfig.clientId}-${Date.now()}`,
            input: JSON.stringify(clientConfig),
        };

        const command = new StartExecutionCommand(params);
        const result = await client.send(command);
        console.log('Started Step Functions execution:', result.executionArn);

    } catch (error) {
        console.error('Error processing client:', error);
        throw error;
    }
}