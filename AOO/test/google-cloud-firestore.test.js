const fs = require('fs');
const path = require('path');

process.env.GOOGLE_CLOUD_LOCAL_FALLBACK = 'true';
const { GoogleCloudService } = require('../src/google-cloud-service');

describe('GoogleCloudService Firestore (local fallback)', () => {
  const localRoot = path.join(__dirname, '..', 'local_google_cloud');
  const collection = 'testCollection';
  const documentId = 'doc-1';
  const testData = { name: 'Alice', age: 30, active: true };

  beforeAll(async () => {
    if (fs.existsSync(localRoot)) fs.rmSync(localRoot, { recursive: true, force: true });
    await GoogleCloudService.connect();
  });

  afterAll(() => {
    if (fs.existsSync(localRoot)) fs.rmSync(localRoot, { recursive: true, force: true });
  });

  test('saveToFirestore writes local file', async () => {
    const res = await GoogleCloudService.saveToFirestore(collection, documentId, testData);
    expect(res.success).toBe(true);

    const fullPath = path.join(localRoot, 'firestore', collection, `${documentId}.json`);
    expect(fs.existsSync(fullPath)).toBe(true);

    const stored = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    expect(stored.name).toBe('Alice');
    expect(stored.age).toBe(30);
    expect(stored.active).toBe(true);
  });

  test('getFromFirestore returns stored data', async () => {
    const res = await GoogleCloudService.getFromFirestore(collection, documentId);
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data.name).toBe('Alice');
    expect(res.data.age).toBe(30);
    expect(res.data.active).toBe(true);
  });
});
