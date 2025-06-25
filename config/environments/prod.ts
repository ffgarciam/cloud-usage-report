import { CloudUsageReportConfig } from "../context";

export const prod: CloudUsageReportConfig = {
    environment: 'prod',
    notificationEmail: 'alert@company.com',
    notificationLambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:aggregation-function'
}