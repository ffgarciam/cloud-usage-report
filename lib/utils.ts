import * as context from '../config';
import { ApplicationEnvironment } from "../config/context";

export function getEnvironmentSettings() {
    // Check for existing environment env var
    for (const envKey of ['CDK_ENVIRONMENT']) {
        if (process.env[envKey] === undefined) {
            throw new Error(`Env variable "${envKey}" not set`);
        }
    }

    const environmentLocal = process.env.CDK_ENVIRONMENT as ApplicationEnvironment;
    const environmentContextLocal = context[environmentLocal];

    if (environmentContextLocal === undefined) {
        throw new Error(`Environment "${environmentLocal}" not found in config`);
    }

    return environmentContextLocal;
}