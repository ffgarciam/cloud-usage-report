import { aws_dynamodb, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { ITable, Table } from 'aws-cdk-lib/aws-dynamodb';
import { IKey, Key } from 'aws-cdk-lib/aws-kms';
import { BlockPublicAccess, Bucket, BucketEncryption, StorageClass } from 'aws-cdk-lib/aws-s3';
import { ITopic, Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import { CurWorkflow } from './cur-workflow-construct';
import { CurDashboardLogs } from './cur-dashboard-logs';


export interface CloudUsageReportStackProps extends StackProps {
	notificationEmail: string;
	notificationLambdaArn: string;
	environment: string;
}

export class CloudUsageReportStack extends Stack {
	constructor(scope: Construct, id: string, props: CloudUsageReportStackProps) {
		super(scope, id, props);

		// TODO: why AWS customer managed key and not AWS managed key ?
		const encryptionKey = this.createEncryptionKey(props);
		const curTable = this.createDdbTable(encryptionKey, props);
		const processedBucket = this.createCURBucket(encryptionKey);
		const topic = this.createSnsTopic(encryptionKey, props);
		
		const curWorkflow = new CurWorkflow(this, 'CurWorkflow', {
			environment: props.environment,
			clientConfigTable: curTable,
			curBucket: processedBucket,
			notificationTopic: topic,
			encryptionKey,
			notificationLambdaArn: props.notificationLambdaArn
		});	

		new CurDashboardLogs(this, 'CurDashboardLogs', {
			environment: props.environment,
			streamProcessorLambda: curWorkflow.streamProcessorLambda,
			processCurLambda: curWorkflow.processCurLambda,
			processingStateMachine: curWorkflow.processingStateMachine
		})
	}

	private createEncryptionKey(props: CloudUsageReportStackProps): IKey {
		return new Key(this, 'CurProcessorKey', {
			description: 'KMS key for CUR processor encryption',
			enableKeyRotation: true,
			removalPolicy: RemovalPolicy.RETAIN,
			alias: `cur-processor-${props.environment}`,
		});
	}

	private createDdbTable(encryptionKey: IKey, props: CloudUsageReportStackProps): ITable {
		return new Table(this, 'CloudUsageReport', {
			tableName: `cur-client-config-${props.environment}`,
			partitionKey: {
				name: 'client_id',
				type: aws_dynamodb.AttributeType.STRING
			},
			billingMode: aws_dynamodb.BillingMode.PAY_PER_REQUEST,
			encryption: aws_dynamodb.TableEncryption.CUSTOMER_MANAGED,
			encryptionKey,
			stream: aws_dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
			pointInTimeRecoverySpecification: {
				pointInTimeRecoveryEnabled: true
			},
			removalPolicy: RemovalPolicy.RETAIN,
		});
	}

	private createCURBucket(encryptionKey: IKey) {
		return new Bucket(this, 'ProcessedCURBucket', {
			encryption: BucketEncryption.KMS,
			encryptionKey,
			versioned: true,
			lifecycleRules: [
				{
					id: 'intelligent-tiering',
          			enabled: true,
					expiration: Duration.days(730), // 2 years
					transitions: [
						{
							storageClass: StorageClass.INTELLIGENT_TIERING,
							transitionAfter: Duration.days(0),
						},
						{
							storageClass: StorageClass.GLACIER,
							transitionAfter: Duration.days(90)
						}
					]
				}
			],
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			removalPolicy: RemovalPolicy.RETAIN,
			autoDeleteObjects: false,
			serverAccessLogsPrefix: 'access-logs/',
		})
	}

	private createSnsTopic(encryptionKey: IKey, props: CloudUsageReportStackProps): ITopic {
		const topic =  new Topic(this, 'NotificationTopic', {
			topicName: `cur-notifications-${props.environment}`,
			masterKey: encryptionKey,
		});

		topic.addSubscription(
			new EmailSubscription(props.notificationEmail)
		);

		return topic;
	}
}
