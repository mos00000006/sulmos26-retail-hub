export declare const ROLES: string[];
export declare const DOC_TYPES: string[];
export declare function permission(role: string, resource: string, action?: string): boolean;
export declare function validLines(lines: unknown): boolean;
export declare function validMoney(n: unknown): boolean;
export declare function canApprove(role: string, creatorId: string, actorId: string, status: string): boolean;
