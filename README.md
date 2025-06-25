# Cloud Usage Report

## architecture

```text
DynamoDB (Trigger) → Lambda → Step Functions → Cross-Account Processing → S3 Storage → Notifications
```

## AWS Resources

- DynamoDB Table: Client configurations with streams
- S3 Bucket: Encrypted storage with lifecycle policies
- Step Functions: Orchestration with error handling
- KMS: Customer-managed encryption keys
- CloudWatch: Monitoring and alarms

## Lambda Functions

- Stream processor (triggers on DynamoDB)
- Cross-account role assumption
- CUR data processing and transformation
- Notification handling (Lambda + Email)

## setup

- You are already logged in and the AWS_PROFILE, REGION are set up.
- Another variable is needed: CDK_ENVIRONMENT, it can be set like this: `export CDK_ENVIRONMENT=dev`
- Set up a role in client account:

  ```bash
  aws iam create-role --role-name CURProcessorCrossAccountRole \
  --assume-role-policy-document file://trust-policy.json // in clientConfig folder
  ```

  with the `client-role-policy` as well.

## to trigger the stepFunction

The client configuration needs to be added into dynamoDB:

```bash
aws dynamodb put-item --table-name cur-client-config-production \
  --item file://client-config.json
```

