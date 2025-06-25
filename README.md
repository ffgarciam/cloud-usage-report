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
