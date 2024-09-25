import express, { Response } from 'express';

const app = express();

const PORT = 3000;

app.get('/', (_, res: Response) => {
  res.json({
		message: 'Hello World!',
	});
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
