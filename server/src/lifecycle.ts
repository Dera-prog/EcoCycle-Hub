export const PICKUP_STATUSES = [
  'upcoming',
  'assigned',
  'en_route',
  'arrived',
  'completed',
  'cancelled',
] as const;

export type PickupStatus = (typeof PICKUP_STATUSES)[number];

export const ACTIVE_STATUSES: PickupStatus[] = ['upcoming', 'assigned', 'en_route', 'arrived'];

export type AgentAction = 'en_route' | 'arrived' | 'complete' | 'release';

const AGENT_MOVES: Record<AgentAction, { from: PickupStatus[]; to: PickupStatus }> = {
  en_route: { from: ['assigned'], to: 'en_route' },
  arrived: { from: ['en_route'], to: 'arrived' },
  complete: { from: ['arrived'], to: 'completed' },
  release: { from: ['assigned'], to: 'upcoming' },
};

export function isActiveStatus(status: string): boolean {
  return (ACTIVE_STATUSES as string[]).includes(status);
}

export function canAgentMove(from: string, action: AgentAction): boolean {
  const move = AGENT_MOVES[action];
  return !!move && (move.from as string[]).includes(from);
}

export function targetStatus(action: AgentAction): PickupStatus {
  return AGENT_MOVES[action].to;
}

export const CANCELLABLE_STATUSES: PickupStatus[] = ['upcoming', 'assigned'];
