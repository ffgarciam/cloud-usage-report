import { CloudUsageReportConfig } from "../context";

export const dev: CloudUsageReportConfig = {
    environment: 'dev',
    notificationEmail: 'alert@company.com',
    notificationLambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:aggregation-function'
}