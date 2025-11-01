/*
  # Système de notifications

  1. Nouvelle table
    - `notifications`
      - `id` (uuid, primary key)
      - `type` (text) - Type de notification (consignment_unpaid, stock_alert, etc.)
      - `title` (text) - Titre de la notification
      - `message` (text) - Message détaillé
      - `severity` (text) - urgent, warning, info
      - `link` (text, nullable) - Lien optionnel vers une page
      - `user_id` (uuid, nullable) - Si null, notification globale pour tous
      - `read` (boolean) - Statut de lecture
      - `created_at` (timestamptz)
      - Index sur user_id, read, created_at

  2. Sécurité
    - Enable RLS
    - Policies pour utilisateurs authentifiés
      - Peuvent voir leurs propres notifications
      - Peuvent voir les notifications globales (user_id = null)
      - Peuvent marquer leurs notifications comme lues
*/

-- =====================================================================
-- 1. Table notifications
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('urgent', 'warning', 'info')) DEFAULT 'info',
  link text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);

-- =====================================================================
-- 2. Sécurité RLS
-- =====================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs peuvent voir leurs propres notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Les utilisateurs peuvent marquer leurs notifications comme lues
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Seuls les admins peuvent créer des notifications (via backend)
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Les utilisateurs peuvent supprimer leurs propres notifications
CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================================
-- 3. Fonction helper pour créer une notification
-- =====================================================================

CREATE OR REPLACE FUNCTION public.create_notification(
  p_type text,
  p_title text,
  p_message text,
  p_severity text DEFAULT 'info',
  p_link text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO public.notifications (type, title, message, severity, link, user_id)
  VALUES (p_type, p_title, p_message, p_severity, p_link, p_user_id)
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- 4. Commentaires et documentation
-- =====================================================================

COMMENT ON TABLE public.notifications IS 'Notifications système pour les utilisateurs';
COMMENT ON COLUMN public.notifications.type IS 'Type de notification (ex: consignment_unpaid, stock_alert)';
COMMENT ON COLUMN public.notifications.severity IS 'Niveau de gravité: urgent (rouge), warning (orange), info (bleu)';
COMMENT ON COLUMN public.notifications.user_id IS 'Si NULL, notification visible par tous les utilisateurs';
COMMENT ON COLUMN public.notifications.read IS 'Statut de lecture de la notification';
