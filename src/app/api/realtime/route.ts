import { realtimeHub } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export async function GET() {
  const clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      realtimeHub.subscribe(clientId, controller);
      // Send initial welcome message
      const welcome = `event: connected\ndata: ${JSON.stringify({ clientId, timestamp: Date.now() })}\n\n`;
      controller.enqueue(encoder.encode(welcome));
    },
    cancel() {
      realtimeHub.unsubscribe(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
