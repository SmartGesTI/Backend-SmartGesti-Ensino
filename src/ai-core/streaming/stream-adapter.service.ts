import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { StreamEvent } from './stream.types';

export interface SSEEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

@Injectable()
export class StreamAdapterService {
  /**
   * Converte Observable de StreamEvent para formato SSE (Server-Sent Events)
   */
  toSSE(stream$: Observable<StreamEvent>): Observable<SSEEvent> {
    return new Observable<SSEEvent>((subscriber) => {
      let eventId = 0;

      stream$.subscribe({
        next: (event) => {
          subscriber.next({
            id: String(eventId++),
            event: event.type,
            data: JSON.stringify(event.data),
          });
        },
        error: (error) => {
          subscriber.next({
            id: String(eventId++),
            event: 'error',
            data: JSON.stringify({ error: error.message }),
          });
          subscriber.complete();
        },
        complete: () => {
          subscriber.complete();
        },
      });
    });
  }

  /**
   * Formata StreamEvent para string SSE
   */
  formatSSE(event: SSEEvent): string {
    const lines: string[] = [];

    if (event.id !== undefined) {
      lines.push(`id: ${event.id}`);
    }

    if (event.event) {
      lines.push(`event: ${event.event}`);
    }

    if (event.retry !== undefined) {
      lines.push(`retry: ${event.retry}`);
    }

    lines.push(`data: ${event.data}`);
    lines.push(''); // Linha em branco para separar eventos

    return lines.join('\n');
  }
}
