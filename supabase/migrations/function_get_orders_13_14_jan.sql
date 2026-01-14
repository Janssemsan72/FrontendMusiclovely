-- ============================================
-- Migration: Função RPC para Listar Pedidos 13/01 (21h+) e 14/01
-- ============================================
-- Esta função retorna os pedidos pagos do período especificado
-- que precisam ter letras geradas (sem approval)
-- ============================================

CREATE OR REPLACE FUNCTION get_orders_13_14_jan()
RETURNS TABLE (
  order_id UUID,
  customer_email TEXT,
  paid_at TIMESTAMPTZ,
  quiz_id UUID,
  tem_job BOOLEAN,
  tem_approval BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id as order_id,
    o.customer_email,
    o.paid_at,
    o.quiz_id,
    CASE WHEN j.id IS NOT NULL THEN true ELSE false END as tem_job,
    CASE WHEN la.id IS NOT NULL THEN true ELSE false END as tem_approval
  FROM orders o
  LEFT JOIN jobs j ON j.order_id = o.id
  LEFT JOIN lyrics_approvals la ON la.order_id = o.id
  WHERE o.status = 'paid'
    AND o.quiz_id IS NOT NULL
    AND (
      (o.paid_at >= '2025-01-13 21:00:00-03:00' AND o.paid_at < '2025-01-14 00:00:00-03:00')
      OR
      (o.paid_at >= '2025-01-14 00:00:00-03:00' AND o.paid_at < '2025-01-15 00:00:00-03:00')
    )
  ORDER BY o.paid_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_orders_13_14_jan() IS 
'Retorna pedidos pagos do dia 13/01 (21h+) e 14/01 que precisam ter letras geradas.';
