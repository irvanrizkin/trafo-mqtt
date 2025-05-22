import axios from "axios";
import * as mqtt from "mqtt";
import topicTableMap from "../config/topic-table-map";

interface MqttServiceConfig {
  mqttBroker: string;
  mqttUsername: string;
  mqttPassword: string;
  topicPrefix?: string;
}

interface MqttData {
  topic: string;
  data: string;
  trafoId: number;
}

export class MqttService {
  private mqttClient: mqtt.MqttClient;

  private topicMap = topicTableMap;

  private buffer: MqttData[] = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly BATCH_DURATION = 5000;

  private readonly topicPrefix?: string;

  constructor(config: MqttServiceConfig) {
    this.mqttClient = mqtt.connect(config.mqttBroker, {
      clientId: "mqttjs_" + Math.random().toString(16).substring(2, 8),
      reconnectPeriod: 5000,
      clean: true,
      username: config.mqttUsername,
      password: config.mqttPassword,
    });
    this.topicPrefix = config.topicPrefix;
    this.setup();
  }

  private setup() {
    this.mqttClient.on("connect", () => {
      console.log("Connected to MQTT Broker");

      // Subscribe to all topics
      for (let topic in this.topicMap) {
        if (this.topicPrefix) {
          this.mqttClient.subscribe(`${this.topicPrefix}/${topic}`);
          console.log(`Subscribed to ${this.topicPrefix}/${topic}`);
        } else {
          this.mqttClient.subscribe(topic);
          console.log(`Subscribed to ${topic}`);
        }
      }

      if (this.topicPrefix) {
        this.mqttClient.subscribe(`${this.topicPrefix}/millis`);
      } else {
        this.mqttClient.subscribe("millis");
      }
    });

    this.mqttClient.on("message", (topic, message) => {
      const data = message.toString();
      this.handleIncomingData(topic, data);
    });
  }

  private handleIncomingData(topic: string, data: string) {
    const trafoId = this.getTrafoId(topic);
    const extractedTopic = this.extractTopic(topic);

    this.buffer.push({ topic: extractedTopic, data, trafoId });

    console.log(this.buffer);

    if (!this.timer) {
      this.timer = setTimeout(() => this.sendBatch(), this.BATCH_DURATION);
    }
  }

  private sendBatch() {
    this.timer = null;
    if (this.buffer.length === 0) {
      return;
    }
    const batch = [...this.buffer];
    this.buffer = [];
    console.log("Sending batch:", batch);
    const mappedData = this.mapToJson(batch);
    console.log("Mapped data:", mappedData);

    this.sendToApi(mappedData)
      .then(() => {
        console.log("Batch sent successfully");
      })
      .catch((error) => {
        console.error("Error sending batch:", error);
      });
  }

  private async sendToApi(mappedData: any) {
    try {
      const response = await axios.post(
        `${process.env.BASE_URL}/api/metric/1/mqtt`,
        mappedData,
      );
      console.log("Data sent to API:", response.data);
    } catch (error) {
      console.error("Error sending data to API:", error);
    }
  }

  private mapToJson(batch: MqttData[]) {
    console.log("Passing batch to mapToJson:", batch);

    // Grouped as: { trafoId: { [table]: { ...columns } } }
    const grouped: Record<
      string | number,
      Record<string, Record<string, any>>
    > = {};

    for (const { topic, data, trafoId } of batch) {
      const topicConfig = this.topicMap[topic as keyof typeof this.topicMap];
      if (!topicConfig) {
        console.error(`Topic ${topic} is not defined in topicMap.`);
        continue;
      }

      const { table, column } = topicConfig;
      const payload = data === "" ? "0" : data;

      if (!grouped[trafoId]) {
        grouped[trafoId] = {};
      }

      if (!grouped[trafoId][table]) {
        grouped[trafoId][table] = {
          trafo_id: trafoId,
          topic_name: topic,
          [column]: payload,
        };
      } else {
        grouped[trafoId][table][column] = payload;
      }
    }

    // Flatten grouped structure into array of { table, data }
    const result: { table: string; data: any }[] = [];

    for (const trafoTables of Object.values(grouped)) {
      for (const [table, data] of Object.entries(trafoTables)) {
        result.push({ table, data });
      }
    }

    return result;
  }

  private getTrafoId(topic: string): number {
    const match = topic.match(/\d+$/);
    if (match) {
      const number = parseInt(match[0], 10);
      return number >= 94 ? 2 : 1;
    } else {
      console.error(`No trafo_id found in topic: ${topic}`);
      return 0; // or some default value
    }
  }

  private extractTopic(topic: string): string {
    return topic.split("/").pop() || "";
  }
}
