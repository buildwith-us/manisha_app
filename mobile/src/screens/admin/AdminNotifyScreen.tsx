import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorBanner, Input, Screen } from '../../components/ui';
import { adminApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { colors, radius, spacing, typography } from '../../theme';

type Audience = 'all' | 'retail' | 'wholesale';

const AUDIENCES: Array<{ value: Audience; label: string; hint: string }> = [
  { value: 'all', label: 'Everyone', hint: 'All active accounts' },
  { value: 'retail', label: 'Retail only', hint: 'Retail customers' },
  { value: 'wholesale', label: 'Wholesale only', hint: 'Approved wholesale buyers' },
];

/** PRD 4.7 — push notification composer: broadcast or segmented by tier. */
export function AdminNotifyScreen() {
  const [audience, setAudience] = useState<Audience>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const errors = {
    title: title.trim().length < 2 ? 'Add a short title' : null,
    body: body.trim().length < 2 ? 'Add the message body' : null,
  };
  const isValid = !errors.title && !errors.body;

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const result = await adminApi.sendNotification({
        audience,
        title: title.trim(),
        body: body.trim(),
      });
      setTitle('');
      setBody('');
      Alert.alert(
        'Notification sent',
        `Delivered to ${result.delivered ?? 0} device(s) across ${result.recipients} account(s).`,
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send the notification.');
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => {
    setTouched(true);
    if (!isValid) return;

    const label = AUDIENCES.find((entry) => entry.value === audience)?.label ?? 'everyone';
    Alert.alert(
      'Send this notification?',
      `It will go out immediately to ${label.toLowerCase()}. This cannot be recalled.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send now', onPress: () => void send() },
      ],
    );
  };

  return (
    <Screen scroll edges={['bottom']}>
      {error ? <ErrorBanner message={error} /> : null}

      <Text style={styles.sectionLabel}>Send to</Text>
      <View style={styles.audiences}>
        {AUDIENCES.map((option) => {
          const active = audience === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setAudience(option.value)}
              style={[styles.audience, active && styles.audienceActive]}
            >
              <View style={[styles.radio, active && styles.radioActive]}>
                {active ? <View style={styles.radioDot} /> : null}
              </View>
              <View>
                <Text style={styles.audienceLabel}>{option.label}</Text>
                <Text style={styles.audienceHint}>{option.hint}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Input
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="Festive sale is live"
        maxLength={120}
        error={touched ? errors.title : null}
      />

      <Input
        label="Message"
        value={body}
        onChangeText={setBody}
        placeholder="Up to 30% off on bridal sets this week."
        multiline
        numberOfLines={4}
        maxLength={500}
        style={styles.textarea}
        error={touched ? errors.body : null}
        hint={`${body.length}/500 characters`}
      />

      <Text style={styles.sectionLabel}>Preview</Text>
      <Card style={styles.preview}>
        <Text style={styles.previewApp}>MANISHA FASHIONS · now</Text>
        <Text style={styles.previewTitle}>{title.trim() || 'Notification title'}</Text>
        <Text style={styles.previewBody}>
          {body.trim() || 'Your message will appear here.'}
        </Text>
      </Card>

      <Button label="Send notification" onPress={handleSend} loading={sending} />

      <Text style={styles.footnote}>
        Customers who have push disabled still receive this in their in-app notification list.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { ...typography.captionStrong, color: colors.text, marginBottom: spacing.sm },
  audiences: { gap: spacing.sm, marginBottom: spacing.xl },
  audience: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  audienceActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  audienceLabel: { ...typography.bodyStrong, color: colors.text },
  audienceHint: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },

  textarea: { minHeight: 100, textAlignVertical: 'top' },

  preview: { backgroundColor: colors.surfaceAlt, marginBottom: spacing.xl },
  previewApp: { ...typography.tiny, color: colors.textMuted, letterSpacing: 0.5 },
  previewTitle: { ...typography.bodyStrong, color: colors.text, marginTop: spacing.xs },
  previewBody: { ...typography.caption, color: colors.textMuted, marginTop: 2, lineHeight: 19 },

  footnote: {
    ...typography.tiny,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
