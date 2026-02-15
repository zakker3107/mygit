const fs = require('fs');
const path = require('path');

// Ensure tests run with local fallback
process.env.GOOGLE_CLOUD_LOCAL_FALLBACK = 'true';

const { GoogleCloudService } = require('../src/google-cloud-service');

describe('GoogleCloudService (local fallback)', () => {
  const localRoot = path.join(__dirname, '..', 'local_google_cloud');
  const testFilePath = 'testdir/test-file.txt';
  const testBucket = 'ignored-bucket';

  beforeAll(() => {
    // clean up local root before tests
    if (fs.existsSync(localRoot)) {
      fs.rmSync(localRoot, { recursive: true, force: true });
    }
    // ensure service is connected (local fallback)
    return GoogleCloudService.connect();
  });

  afterAll(() => {
    // cleanup after tests
    if (fs.existsSync(localRoot)) {
      try { fs.rmSync(localRoot, { recursive: true, force: true }); } catch (e) {}
    }
  });

  test('uploadFile writes file to local fallback path', async () => {
    const data = Buffer.from('hello world');
    const result = await GoogleCloudService.uploadFile(testBucket, testFilePath, data);
    expect(result.success).toBe(true);

    const fullPath = path.join(localRoot, testFilePath);
    const exists = fs.existsSync(fullPath);
    expect(exists).toBe(true);

    const content = fs.readFileSync(fullPath).toString();
    expect(content).toBe('hello world');
  });

  test('listFiles returns the uploaded file', async () => {
    const res = await GoogleCloudService.listFiles(testBucket, 'testdir/');
    expect(res.success).toBe(true);
    expect(Array.isArray(res.files)).toBe(true);
    const names = res.files.map(f => f.name);
    expect(names.some(n => n.endsWith('test-file.txt'))).toBe(true);
  });

  test('downloadFile returns file data', async () => {
    const res = await GoogleCloudService.downloadFile(testBucket, testFilePath);
    expect(res.success).toBe(true);
    const text = res.data.toString ? res.data.toString() : String(res.data);
    expect(text).toBe('hello world');
  });

  test('deleteFile removes the file', async () => {
    const res = await GoogleCloudService.deleteFile(testBucket, testFilePath);
    expect(res.success).toBe(true);

    const fullPath = path.join(localRoot, testFilePath);
    expect(fs.existsSync(fullPath)).toBe(false);
  });
});
