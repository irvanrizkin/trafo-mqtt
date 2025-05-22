import "dotenv/config";
import express, { Response } from "express";
import { MqttService } from "./services/MqttService";

const app = express();

const PORT = 3000;

new MqttService({
  mqttBroker: process.env.MQTT_BROKER || "mqtt://broker.emqx.io",
  mqttUsername: process.env.MQTT_USERNAME || "",
  mqttPassword: process.env.MQTT_PASSWORD || "",
  topicPrefix: process.env.TOPIC_PREFIX,
});

app.get("/", (_, res: Response) => {
  res.json({
    message: "Hello World!",
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
