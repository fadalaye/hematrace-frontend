// interceptors/http-interceptor.ts
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const startTime = Date.now();
    
    // Log de la requête sortante
    console.log('🚀 Requête HTTP:', {
      url: req.url,
      method: req.method,
      headers: this.sanitizeHeaders(req.headers),
      body: this.sanitizeBody(req.body),
      timestamp: new Date().toISOString()
    });

    return next.handle(req).pipe(
      tap({
        next: (event) => {
          if (event instanceof HttpResponse) {
            const duration = Date.now() - startTime;
            console.log('✅ Réponse HTTP réussie:', {
              status: event.status,
              statusText: event.statusText,
              url: req.url,
              duration: `${duration}ms`,
              body: this.sanitizeBody(event.body),
              timestamp: new Date().toISOString()
            });
          }
        },
        error: (error: HttpErrorResponse) => {
          const duration = Date.now() - startTime;
          console.error('❌ Erreur HTTP:', {
            status: error.status,
            statusText: error.statusText,
            url: error.url || req.url,
            duration: `${duration}ms`,
            error: this.sanitizeError(error.error),
            headers: error.headers ? this.sanitizeHeaders(error.headers) : undefined,
            timestamp: new Date().toISOString()
          });
        }
      })
    );
  }

  /**
   * Nettoie les headers pour le logging (supprime les tokens sensibles)
   */
  private sanitizeHeaders(headers: any): any {
    const sanitized: any = {};
    const sensitiveKeys = ['authorization', 'token', 'password', 'secret'];
    
    for (const key of headers.keys()) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '***MASKED***';
      } else {
        sanitized[key] = headers.get(key);
      }
    }
    
    return sanitized;
  }

  /**
   * Nettoie le body pour le logging (supprime les données sensibles)
   */
  private sanitizeBody(body: any): any {
    if (!body) return body;
    
    try {
      const bodyStr = JSON.stringify(body);
      const sanitized = bodyStr.replace(/"motDePasse":"[^"]*"/g, '"motDePasse":"***MASKED***"')
                              .replace(/"password":"[^"]*"/g, '"password":"***MASKED***"')
                              .replace(/"token":"[^"]*"/g, '"token":"***MASKED***"');
      return JSON.parse(sanitized);
    } catch {
      return body;
    }
  }

  /**
   * Nettoie les erreurs pour le logging
   */
  private sanitizeError(error: any): any {
    if (!error) return error;
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (typeof error === 'object') {
      const sanitized = { ...error };
      const sensitiveFields = ['motDePasse', 'password', 'token', 'secret', 'credentials'];
      
      sensitiveFields.forEach(field => {
        if (sanitized[field]) {
          sanitized[field] = '***MASKED***';
        }
      });
      
      return sanitized;
    }
    
    return error;
  }
}