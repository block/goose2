import type {
  ProviderField,
  ProviderFieldValue,
  ProviderSetupMethod,
} from "@/shared/types/providers";

export const MAX_SETUP_OUTPUT_LINES = 8;

export interface SetupOutputLine {
  id: number;
  text: string;
}

export function getDefaultFieldValue(field: ProviderField): ProviderFieldValue {
  return {
    key: field.key,
    value: null,
    isSet: false,
    isSecret: field.secret,
    required: field.required,
  };
}

export function resolveFieldValue(
  field: ProviderField,
  fieldValueMap: Map<string, ProviderFieldValue>,
): ProviderFieldValue {
  return fieldValueMap.get(field.key) ?? getDefaultFieldValue(field);
}

export function getDisplayValue(
  field: ProviderField,
  fieldValueMap: Map<string, ProviderFieldValue>,
): string {
  const fieldValue = resolveFieldValue(field, fieldValueMap);
  if (!fieldValue.isSet) return "Not set";
  return fieldValue.value ?? "Saved";
}

export function createDraftValues(
  fields: ProviderField[],
  values: ProviderFieldValue[],
): Record<string, string> {
  const valueMap = new Map(values.map((value) => [value.key, value]));
  return Object.fromEntries(
    fields.map((field) => {
      const currentValue = valueMap.get(field.key);
      if (field.secret) {
        return [field.key, ""];
      }
      return [field.key, currentValue?.value ?? ""];
    }),
  );
}

export function getSetupMessage(
  setupMethod: ProviderSetupMethod,
  isConnected: boolean,
  supportsNativeConnect: boolean,
): string | null {
  if (isConnected) {
    switch (setupMethod) {
      case "oauth_device_code":
        return "Connected through Goose device-code sign-in.";
      case "oauth_browser":
        return "Connected through Goose sign-in.";
      case "cloud_credentials":
        return "Connected through your cloud credentials.";
      case "local":
        return "Running locally.";
      default:
        return null;
    }
  }

  switch (setupMethod) {
    case "oauth_browser":
    case "oauth_device_code":
      return supportsNativeConnect
        ? "Goose will guide you through sign-in from here."
        : "Run `goose configure` in your terminal to finish sign-in.";
    case "cloud_credentials":
      return "Configure your cloud credentials in your terminal environment before using this provider.";
    case "local":
      return "This provider runs locally and does not need saved settings here.";
    default:
      return null;
  }
}

export function getNativeConnectDescription(
  setupMethod: ProviderSetupMethod,
): string | null {
  switch (setupMethod) {
    case "oauth_device_code":
    case "oauth_browser":
      return "Sign in with your existing account.";
    default:
      return null;
  }
}

export function getFieldSetupDescription(
  setupMethod: ProviderSetupMethod,
): string | null {
  switch (setupMethod) {
    case "single_api_key":
      return "Set up saves the API key Goose needs for this provider.";
    case "config_fields":
      return "Set up saves the provider details Goose needs, such as an API key, endpoint, or model settings.";
    case "host_with_oauth_fallback":
      return "Set up saves the host details Goose needs here. You can add a token now, or leave it blank and sign in afterward from Goose.";
    case "cloud_credentials":
      return "Set up saves any provider details Goose needs here. Your actual authentication still comes from your cloud credentials.";
    default:
      return null;
  }
}

export function renderInlineCodeMessage(message: string) {
  const command = "`goose configure`";
  if (!message.includes(command)) {
    return <p className="text-xs text-muted-foreground">{message}</p>;
  }

  const [before, after] = message.split(command);
  return (
    <p className="text-xs text-muted-foreground">
      {before}
      <code className="rounded bg-muted px-1 py-0.5 text-xxs">
        goose configure
      </code>
      {after}
    </p>
  );
}

export function renderSetupMessage(message: string | null) {
  if (!message) {
    return null;
  }

  if (message.includes("`goose configure`")) {
    return renderInlineCodeMessage(message);
  }

  return <p className="text-xs text-muted-foreground">{message}</p>;
}
