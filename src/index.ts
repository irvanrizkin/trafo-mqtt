import 'dotenv/config';
import express, { Response } from 'express';
import { MqttService } from './services/MqttService';

const app = express();

const PORT = 3000;

MqttService.connect();

app.get('/', (_, res: Response) => {
  res.json({
		message: 'Hello World!',
	});
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
