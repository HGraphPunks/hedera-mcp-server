// test/unit/fileService.test.ts
import { fileService } from "../../src/services/fileService";

describe("FileService", () => {
    jest.setTimeout(20000); // allow enough time for network operations if any

    test("storeFile and fetchFile should round-trip small content", async () => {
        const content = "Hello Hedera!";
        const ownerAccount = process.env.HEDERA_OPERATOR_ID!;      // using operator as owner for test
        const ownerKey = process.env.HEDERA_OPERATOR_KEY!;
        const topicId = await fileService.storeFile(content, ownerAccount, ownerKey);
        expect(topicId).toMatch(/^0\.0\./);  // topicId like 0.0.x
        // Immediately fetch the file back
        const fetched = await fileService.fetchFile(topicId);
        expect(fetched).toBe(content);
    });

    test("storeFile should chunk large content", async () => {
        // Create a string larger than MAX_CHUNK_SIZE (4096 bytes)
        const size = 5000;
        const largeContent = "x".repeat(size);
        const ownerAccount = process.env.HEDERA_OPERATOR_ID!;
        const ownerKey = process.env.HEDERA_OPERATOR_KEY!;
        const topicId = await fileService.storeFile(largeContent, ownerAccount, ownerKey);
        // fetch back
        const fetched = await fileService.fetchFile(topicId);
        expect(fetched.length).toEqual(size);
        expect(fetched).toEqual(largeContent);
    });
});
