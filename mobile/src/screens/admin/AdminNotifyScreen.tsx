import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Button,
  ErrorBanner,
  FieldRow,
  Group,
  NavBar,
  Screen,
  SectionLabel,
  Segmented,
} from '../../components/ui';
import { adminApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { colors, radius, shadow, spacing, typography } from '../../theme';

type Audience = 'all' | 'retail' | 'wholesale';

const AUDIENCES: Array<{ value: Audience; label: string; hint: string }> = [
  { value: 'all', label: 'Everyone', hint: 'All active accounts' },
  { value: 'retail', label: 'Retail', hint: 'Retail customers only' },
  { value: 'wholesale', label: 'Trade', hint: 'Approved wholesale buyers only' },
];

/**
 * PRD 4.7 — screen 29. Compose, then see the push exactly as it will land.
 * The preview is the point of the screen: it is the only proof of what the
 * customer gets, and there is no undo once it is delivered.
 */
export function AdminNotifyScreen() {
  const navigation = useNavigation();
  const [audience, setAudience] = useState<Audience>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

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

  const selected = AUDIENCES.find((entry) => entry.value === audience);

  const handleSend = () => {
    setTouched(true);
    if (!isValid) return;

    Alert.alert(
      'Send this notification?',
      `It will go out immediately to ${(selected?.label ?? 'everyone').toLowerCase()}. This cannot be recalled.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send now', onPress: () => void send() },
      ],
    );
  };

  return (
    <Screen edges={['top']}>
      <NavBar title="Notify" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          {error ? <ErrorBanner message={error} /> : null}

          <Segmented options={AUDIENCES} value={audience} onChange={setAudience} />
          <Text style={styles.audienceHint}>{selected?.hint}</Text>

          <View style={styles.block}>
            <Group>
              <FieldRow label="Title" focused={focused === 'title'}>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  onFocus={() => setFocused('title')}
                  onBlur={() => setFocused(null)}
                  placeholder="New bridal sets just landed"
                  placeholderTextColor={colors.textDisabled}
                  maxLength={120}
                  style={styles.titleInput}
                />
              </FieldRow>
              <FieldRow
                label={`Message · ${body.length}/500`}
                focused={focused === 'body'}
              >
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  onFocus={() => setFocused('body')}
                  onBlur={() => setFocused(null)}
                  placeholder="Fourteen new Kundan sets at trade pricing."
                  placeholderTextColor={colors.textDisabled}
                  multiline
                  maxLength={500}
                  style={styles.bodyInput}
                />
              </FieldRow>
            </Group>
            {touched && (errors.title || errors.body) ? (
              <Text style={styles.error}>{errors.title ?? errors.body}</Text>
            ) : null}
          </View>

          <View style={styles.block}>
            <SectionLabel>Preview on device</SectionLabel>
            <View style={[styles.push, shadow]}>
              <View style={styles.pushIcon}>
                <Text style={styles.pushIconText}>M</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.pushTop}>
                  <Text style={styles.pushApp}>MANISHA FASHIONS</Text>
                  <Text style={styles.pushTime}>now</Text>
                </View>
                <Text style={styles.pushTitle} numberOfLines={1}>
                  {title.trim() || 'Notification title'}
                </Text>
                <Text style={styles.pushBody} numberOfLines={2}>
                  {body.trim() || 'Your message will appear here.'}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Button
          label={`Send to ${(selected?.label ?? 'everyone').toLowerCase()}`}
          onPress={handleSend}
          loading={sending}
          disabled={!isValid}
        />
        <Text style={styles.footnote}>
          Sends immediately. There is no undo once delivered — accounts with push disabled still
          get it in their in-app list.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xl },
  audienceHint: { ...typography.footnote, color: colors.textFaint, marginTop: spacing.md },
  block: { marginTop: spacing.xl },

  titleInput: { ...typography.row, fontWeight: '500', color: colors.text, paddingVertical: 0, marginTop: 4 },
  bodyInput: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 25,
    marginTop: 6,
    paddingVertical: 0,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  error: { ...typography.footnote, color: colors.primary, marginTop: spacing.md },

  push: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  pushIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pushIconText: { ...typography.bodyStrong, fontWeight: '600', color: colors.textInverse },
  pushTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  pushApp: { ...typography.tiny, color: colors.textMuted },
  pushTime: { ...typography.tiny, fontWeight: '400', color: colors.textFaint },
  pushTitle: { ...typography.calloutStrong, fontWeight: '600', color: colors.text, marginTop: 3 },
  pushBody: { ...typography.caption, color: colors.textMuted, lineHeight: 20, marginTop: 2 },

  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  footnote: {
    ...typography.footnote,
    color: colors.textFaint,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: spacing.md,
  },
});
