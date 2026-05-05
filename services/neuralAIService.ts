import * as tf from '@tensorflow/tfjs';
import { LottoResult } from '../types';

export class LotteryAI {
  private model: tf.LayersModel;

  constructor() {
    this.model = this.buildModel();
  }

  private buildModel() {
    const model = tf.sequential();

    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu',
      inputShape: [10],
    }));

    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu',
    }));

    model.add(tf.layers.dense({
      units: 100, // Predict 00-99
      activation: 'softmax',
    }));

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  async train(history: LottoResult[], force = false) {
    if (history.length < 20) return;

    // Try to load existing model first if not forcing re-train
    if (!force) {
      try {
        const loadedModel = await tf.loadLayersModel('indexeddb://lottery-ai-model');
        this.model = loadedModel;
        this.model.compile({
          optimizer: 'adam',
          loss: 'categoricalCrossentropy',
          metrics: ['accuracy'],
        });
        console.log('🧠 Neural AI: Loaded existing model from memory');
        return;
      } catch (e) {
        console.log('🧠 Neural AI: No saved model found, starting fresh training');
      }
    }

    const xTrain: number[][] = [];
    const yTrain: number[][] = [];

    // Prepare data: use sliding window of 10 draws to predict the 11th
    for (let i = history.length - 11; i >= 0; i--) {
      const window = history.slice(i + 1, i + 11).map(d => parseInt(d.r2, 10) / 100);
      const label = parseInt(history[i].r2, 10);

      const oneHot = new Array(100).fill(0);
      oneHot[label] = 1;

      xTrain.push(window);
      yTrain.push(oneHot);
    }

    const xs = tf.tensor2d(xTrain);
    const ys = tf.tensor2d(yTrain);

    await this.model.fit(xs, ys, {
      epochs: 30,
      batchSize: 16,
      verbose: 0
    });

    // Save the model to IndexedDB
    try {
      await this.model.save('indexeddb://lottery-ai-model');
      console.log('🧠 Neural AI: Model saved to memory successfully');
    } catch (e) {
      console.error('🧠 Neural AI: Failed to save model', e);
    }

    xs.dispose();
    ys.dispose();
  }

  predict(last10: number[]) {
    const input = last10.map(v => v / 100);
    const tensor = tf.tensor2d([input]);
    const output = this.model.predict(tensor) as tf.Tensor;
    const data = output.dataSync();
    
    let maxIdx = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i] > data[maxIdx]) maxIdx = i;
    }

    tensor.dispose();
    output.dispose();
    
    return {
      prediction: maxIdx.toString().padStart(2, '0'),
      confidence: data[maxIdx]
    };
  }
}

export const neuralAI = new LotteryAI();
