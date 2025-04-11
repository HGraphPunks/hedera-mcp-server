// test/unit/connectionService.test.ts
import { connectionService } from "../../src/services/connectionService";

describe('Connection Service - listConnections', () => {
    it('should return an empty array when no connections exist for an agent', () => {
        const connections = connectionService.listConnections("0.0.00000");
        expect(Array.isArray(connections)).toBeTruthy();
        expect(connections.length).toBe(0);
    });
});
