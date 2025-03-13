// Client-side monitoring utilities
const log = async (type: string, severity: string, message: string, data: any = {}) => {
    if (process.env.NODE_ENV === 'production') {
        try {
            const response = await fetch('/api/monitoring', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type,
                    severity,
                    message,
                    data,
                }),
            });

            if (!response.ok) {
                console.error('Failed to log to monitoring API:', await response.text());
            }
        } catch (error) {
            console.error('Failed to log to monitoring API:', error);
        }
    }
};

export const logError = async (error: Error | string, context: any = {}) => {
    const message = error instanceof Error ? error.message : error;
    await log('errors', 'ERROR', message, context);
    console.error(message, context);
};

export const logInfo = async (message: string, data: any = {}) => {
    await log('info', 'INFO', message, data);
    console.log(message, data);
};

export const logMetric = async (name: string, value: number, labels: Record<string, string> = {}) => {
    await log('metrics', 'INFO', `Metric: ${name}`, { name, value, labels });
    console.log(`Metric - ${name}:`, { value, labels });
};

// Performance monitoring
export function recordPerformanceMetric(name: string, duration: number) {
    console.log(`Performance metric: ${name} took ${duration}ms`, {
        type: 'performance',
        metric: name,
        duration,
    });
} 