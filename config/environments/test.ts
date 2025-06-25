import { CloudUsageReportConfig } from "../context";

export const test: CloudUsageReportConfig = {
    environment: 'test',
    notificationEmail: 'alert@company.com',
    notificationLambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:aggregation-function'
}