#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CloudUsageReportStack } from '../lib/cloud-usage-report-stack';
import { getEnvironmentSettings } from '../lib/utils';

const environmentContext = getEnvironmentSettings()

const app = new cdk.App();

new CloudUsageReportStack(app, `CurProcessorStack-${environmentContext.environment}`, {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
    ...environmentContext,
    description: 'AWS CUR Processing Pipeline for client billing data',
});