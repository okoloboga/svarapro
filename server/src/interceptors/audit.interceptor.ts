import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user } = request;
    const startTime = Date.now();

    // Определяем критичность операции
    const isCritical = this.isCriticalOperation(url, method);
    
    if (isCritical) {
      console.log(`🚨 CRITICAL OPERATION: ${method} ${url}`, {
        user: user?.telegramId || 'anonymous',
        body: this.sanitizeBody(body),
        timestamp: new Date().toISOString(),
      });
    }
    


    return next.handle().pipe(
      tap({
        next: (data) => {
          if (isCritical) {
            const duration = Date.now() - startTime;
            console.log(`✅ CRITICAL OPERATION COMPLETED: ${method} ${url}`, {
              user: user?.telegramId || 'anonymous',
              duration: `${duration}ms`,
              timestamp: new Date().toISOString(),
            });
          }
        },
        error: (error) => {
          if (isCritical) {
            const duration = Date.now() - startTime;
            console.error(`❌ CRITICAL OPERATION FAILED: ${method} ${url}`, {
              user: user?.telegramId || 'anonymous',
              error: error.message,
              duration: `${duration}ms`,
              timestamp: new Date().toISOString(),
            });
          }
        },
      }),
    );
  }

  private isCriticalOperation(url: string, method: string): boolean {
    // Финансовые операции
    if (url.includes('/finances/transaction')) return true;
    
    // Создание/присоединение к комнатам
    if (url.includes('/rooms') && (method === 'POST' || method === 'PUT')) return true;
    
    // Игровые действия с деньгами
    if (url.includes('/game') && method === 'POST') return true;
    
    // Админские операции
    if (url.includes('/admin') || url.includes('/admins')) return true;
    
    return false;
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    
    // Убираем чувствительные данные из логов
    const sanitized = { ...body };
    if (sanitized.password) sanitized.password = '***';
    if (sanitized.token) sanitized.token = '***';
    if (sanitized.initData) sanitized.initData = '***';
    
    return sanitized;
  }
} 