// test/unit/agentService.test.ts
import { profileToMemo } from "../../src/services/profileUtil";

describe('Agent Service - profileToMemo', () => {
    it('should return a valid JSON string for a given profile object', () => {
        const profile = {
            name: "TestAgent",
            inboundTopicId: "0.0.12345",
            outboundTopicId: "0.0.12346",
            type: 1,
            capabilities: [0, 1],
            model: "gpt-4",
            creator: "Tester"
        };
        const memo = profileToMemo(profile);
        expect(() => JSON.parse(memo)).not.toThrow();
        const parsed = JSON.parse(memo);
        expect(parsed.name).toBe("TestAgent");
        expect(parsed.inboundTopicId).toBe("0.0.12345");
    });
});
