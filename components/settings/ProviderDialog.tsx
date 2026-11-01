"use client";

import * as React from "react";
import { ArrowUpRight, Save } from "lucide-react";
import { Button, Dialog, Input, Select, Switch } from "@/components/ui/kit";
import { apiPatch, apiPost, notifyDataChanged } from "@/lib/client/api";
import type { ProviderPreset } from "@/lib/defaults";
import type { ModelOption, ProviderConfig, ProviderKind } from "@/lib/types";
import { ProviderModelsField } from "./ProviderModelsField";
import { PROVIDER_KINDS } from "./settings-utils";

export interface ProviderDialogProps {
  open: boolean;
  provider: ProviderConfig | null;
  /** 从「快速添加」选中的品牌预设；新增时用于预填名称 / Base URL / 模型。 */
  preset?: ProviderPreset | null;
  onClose: () => void;
  onSaved: (provider: ProviderConfig) => void;
}

interface ProviderForm {
  kind: ProviderKind;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: ModelOption[];
  enabled: boolean;
  /** 模型列表是否仍来自品牌预设（用于提示「推荐模型」）。 */
  fromPreset: boolean;
}

const DEFAULT_KIND: ProviderKind = "openai";

const EMPTY_FORM: ProviderForm = {
  kind: DEFAULT_KIND,
  name: "",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  models: [],
  enabled: true,
  fromPreset: false,
};

function formFromProvider(provider: ProviderConfig | null): ProviderForm {
  if (!provider) return EMPTY_FORM;
  return {
    kind: provider.kind,
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiKey: "",
    models: provider.models,
    enabled: provider.enabled,
    fromPreset: false,
  };
}

function formFromPreset(preset: ProviderPreset): ProviderForm {
  return {
    kind: preset.kind,
    name: preset.name,
    baseUrl: preset.baseUrl,
    apiKey: "",
    models: preset.models,
    enabled: true,
    fromPreset: true,
  };
}

/** 新增 / 编辑模型服务。apiKey 留空表示不修改已保存的密钥。 */
export function ProviderDialog({ open, provider, preset, onClose, onSaved }: ProviderDialogProps) {
  const [form, setForm] = React.useState<ProviderForm>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setForm(provider ? formFromProvider(provider) : preset ? formFromPreset(preset) : formFromProvider(null));
    setError(null);
    setSaving(false);
  }, [open, provider, preset]);

  const update = <K extends keyof ProviderForm>(key: K, value: ProviderForm[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const changeKind = (kind: ProviderKind) => {
    const next = PROVIDER_KINDS.find((item) => item.value === kind);
    const previousDefault = PROVIDER_KINDS.find((item) => item.value === form.kind)?.defaultBaseUrl ?? "";
    setForm((current) => ({
      ...current,
      kind,
      baseUrl: !current.baseUrl.trim() || current.baseUrl.trim() === previousDefault ? (next?.defaultBaseUrl ?? "") : current.baseUrl,
    }));
  };

  const changeModels = (models: ModelOption[]) => {
    setForm((current) => ({ ...current, models, fromPreset: false }));
  };

  const submit = async () => {
    const name = form.name.trim();
    if (!name) {
      setError("给这个服务起个名字吧，例如「本机 Ollama」。");
      return;
    }
    if (form.kind !== "demo" && !form.baseUrl.trim()) {
      setError("请填写 Base URL。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        kind: form.kind,
        name,
        baseUrl: form.baseUrl.trim(),
        models: form.models,
        enabled: form.enabled,
      };
      const apiKey = form.apiKey.trim();
      const saved = provider
        ? await apiPatch<ProviderConfig>(`/api/providers/${provider.id}`, apiKey ? { ...payload, apiKey } : payload)
        : await apiPost<ProviderConfig>("/api/providers", { ...payload, apiKey });
      notifyDataChanged("providers");
      onSaved(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败，请稍后再试。");
    } finally {
      setSaving(false);
    }
  };

  const kindOption = PROVIDER_KINDS.find((item) => item.value === form.kind);
  const apiKeyHint = provider
    ? `当前密钥：${provider.apiKey || "未设置"}；留空表示不修改。`
    : "密钥只写入本机 SQLite，不会上传到任何服务器。";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={provider ? "编辑模型服务" : "新增模型服务"}
      description="支持任意 OpenAI 兼容接口：官方 API、国内网关、本地 Ollama / vLLM 都可以。"
      width={620}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button variant="primary" icon={<Save className="size-4" />} onClick={submit} loading={saving}>
            保存
          </Button>
        </>
      }
    >
      <form
        className="space-y-3.5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {preset && !provider ? (
          <div className="rounded-md border border-line bg-surface-2/70 px-3 py-2.5">
            <p className="text-[11.5px] leading-5 text-ink-3">{preset.description}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] leading-4">
              {preset.keyUrl ? (
                <a
                  href={preset.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  去 {preset.name} 控制台申请 API Key
                  <ArrowUpRight className="size-3" aria-hidden />
                </a>
              ) : null}
              {preset.note ? <span className="text-ink-3">{preset.note}</span> : null}
            </div>
          </div>
        ) : null}
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Select
            label="接入类型"
            value={form.kind}
            onChange={(event) => changeKind(event.target.value as ProviderKind)}
            options={PROVIDER_KINDS.map((item) => ({ value: item.value, label: item.label }))}
          />
          <Input
            label="名称"
            autoFocus
            maxLength={40}
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="例如：DeepSeek / 本机 Ollama"
            error={error}
          />
        </div>
        <p className="-mt-1 text-[11px] leading-5 text-ink-3">{kindOption?.hint}</p>
        {form.kind === "demo" ? (
          <p className="rounded-md border border-line bg-surface-2/60 px-3 py-2.5 text-[11.5px] leading-5 text-ink-3">
            演示服务完全离线：不需要 Base URL 与 API Key，内置两套示例模型，用来先体验完整流程。
          </p>
        ) : (
          <>
            <Input
              label="Base URL"
              value={form.baseUrl}
              onChange={(event) => update("baseUrl", event.target.value)}
              placeholder={kindOption?.defaultBaseUrl || "https://api.openai.com/v1"}
              hint="通常以 /v1 结尾；Ollama 默认 http://127.0.0.1:11434/v1"
            />
            <Input
              label={provider ? "API Key（可选）" : "API Key"}
              type="password"
              autoComplete="off"
              value={form.apiKey}
              onChange={(event) => update("apiKey", event.target.value)}
              placeholder={provider ? "留空表示不修改" : "sk-…"}
              hint={apiKeyHint}
            />
          </>
        )}
        <ProviderModelsField
          models={form.models}
          onChange={changeModels}
          kind={form.kind}
          baseUrl={form.baseUrl}
          apiKey={form.apiKey}
          providerId={provider?.id ?? null}
          fromPreset={form.fromPreset}
        />
        <div className="flex items-center justify-between rounded-md border border-line bg-surface-2 px-3 py-2.5">
          <Switch
            checked={form.enabled}
            onChange={(checked) => update("enabled", checked)}
            label="启用这个服务"
            hint="停用后不会出现在默认模型选择里"
          />
        </div>
      </form>
    </Dialog>
  );
}
