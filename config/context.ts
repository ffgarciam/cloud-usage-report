export type ApplicationEnvironment = 'dev' | 'test' | 'prod';

export interface Context {
    readonly environment: ApplicationEnvironment;
    readonly guardDutyAntiMalwareStackConfig: CloudUsageReportConfig;
}

export interface CloudUsageReportConfig {
    environment: string;
    notificationEmail: string;
    notificationLambdaArn: string;
}