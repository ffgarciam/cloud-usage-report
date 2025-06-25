import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";

const region = process.env.AWS_REGION;
const stsClient = new STSClient({ region });

interface AssumeRoleInput {
    clientId: string;
    accountId: string;
    roleArn: string;
    externalId: string;
    curBucketName: string;
    curPrefix?: string;
    notificationEmail: string;
}

interface AssumeRoleOutput extends AssumeRoleInput {
    credentials: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken: string;
    };
}

export const handler = async (event: AssumeRoleInput): Promise<AssumeRoleOutput> => {
    console.log('Assuming role for client:', event.clientId);

    try {
        const assumeRoleParams = {
            RoleArn: event.roleArn,
            RoleSessionName: `CURProcessor-${event.clientId}-${Date.now()}`,
            ExternalId: event.externalId,
            DurationSeconds: 3600, // 1 hour
        };

        const command = new AssumeRoleCommand(assumeRoleParams);
        const assumeRoleResult = await stsClient.send(command);

        if (!assumeRoleResult.Credentials) {
        throw new Error('Failed to assume role: No credentials returned');
        }

        return {
        ...event,
        credentials: {
            accessKeyId: assumeRoleResult.Credentials.AccessKeyId!,
            secretAccessKey: assumeRoleResult.Credentials.SecretAccessKey!,
            sessionToken: assumeRoleResult.Credentials.SessionToken!,
        },
        };

    } catch (error) {
        console.error('Error assuming role:', error);
        throw error;
    }
};