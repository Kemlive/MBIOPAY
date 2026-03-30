import { Logger } from 'your-logger-module';

// Importing logger to handle logging functionality
const logger = new Logger();

// Example of handling req.params.id
export const getOrder = (req: Request, res: Response) => {
    const orderId: string = req.params.id as string; // Fixing type for req.params.id
    logger.info(`Fetching order with ID: ${orderId}`);
    // Proceed with fetching order logic... 
};
