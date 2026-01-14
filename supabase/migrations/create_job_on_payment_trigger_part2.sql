-- ============================================
-- Migration PARTE 2: Criar Trigger
-- ============================================
-- Execute esta parte DEPOIS da parte 1
-- ============================================

-- Remover trigger se já existir (para permitir reexecução da migration)
DROP TRIGGER IF EXISTS trigger_create_job_on_payment ON orders;

-- Criar trigger que dispara após UPDATE em orders
-- O trigger só dispara quando status muda para 'paid', então é eficiente
CREATE TRIGGER trigger_create_job_on_payment
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid'))
  EXECUTE FUNCTION create_job_on_payment();

COMMENT ON TRIGGER trigger_create_job_on_payment ON orders IS 
'Dispara após UPDATE na tabela orders quando status muda para paid.
Cria automaticamente um job para iniciar o processo de geração de letras.';
