import { Controller, Get } from '@nestjs/common';
import { LoggerService } from './common/logger/logger.service';

@Controller()
export class AppController {
  constructor(private logger: LoggerService) {}

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('test-logs')
  testLogs() {
    // Testar diferentes níveis de log
    this.logger.log('Teste de log INFO', 'AppController', { test: true });
    this.logger.warn('Teste de log WARN', 'AppController', {
      warning: 'Atenção',
    });
    this.logger.debug('Teste de log DEBUG', 'AppController', { debug: 'info' });
    this.logger.verbose('Teste de log VERBOSE', 'AppController', {
      verbose: 'detalhes',
    });

    return {
      message: 'Logs de teste enviados! Verifique os arquivos em logs/',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('test-error')
  testError() {
    try {
      throw new Error('Erro de teste para verificar logging');
    } catch (error) {
      this.logger.error(
        'Erro de teste capturado',
        error instanceof Error ? error.stack : 'No stack trace',
        'AppController',
        {
          errorType: 'TestError',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        },
      );
      return {
        message: 'Erro de teste logado! Verifique logs/error.log',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
