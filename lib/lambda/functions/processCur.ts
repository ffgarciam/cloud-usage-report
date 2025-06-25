import { 
  S3Client, 
  ListObjectsV2Command, 
  GetObjectCommand, 
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { gunzipSync, gzipSync } from 'zlib';
import { parse } from 'csv-parse';
import { Readable } from 'stream';

const DESTINATION_BUCKET = process.env.DESTINATION_BUCKET!;
const ENCRYPTION_KEY_ID = process.env.ENCRYPTION_KEY_ID!;

interface ProcessCurInput {
    clientId: string;
    accountId: string;
    curBucketName: string;
    curPrefix?: string;
    notificationEmail: string;
    credentials: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken: string;
    };
}

interface ProcessCurOutput {
    clientId: string;
    processedFiles: string[];
    totalRecords: number;
    processingTime: number;
    destinationPath: string;
}

export const handler = async (event: ProcessCurInput): Promise<ProcessCurOutput> => {
    const startTime = Date.now();
    console.log('Processing CUR data for client:', event.clientId);

    // Create S3 client with temporary credentials for source bucket
    const sourceS3Client = new S3Client({
            credentials: {
            accessKeyId: event.credentials.accessKeyId,
            secretAccessKey: event.credentials.secretAccessKey,
            sessionToken: event.credentials.sessionToken,
        },
    });

    // Create S3 client for destination bucket (uses Lambda execution role)
    const destinationS3Client = new S3Client({});

    processData();
};

function processData() {
    // List CUR files in the client's bucket
    // Process each CUR file
    // process the file, parse csv data
    // upload processed data into destination bucket using PutObjectCommand
    // using ENCRYPTION_KEY_ID in SSEKMSKeyId
}