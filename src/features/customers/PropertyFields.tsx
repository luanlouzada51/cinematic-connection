import { Field, Input, Textarea } from "@/components/ui/field";
import type { PropertyDraft } from "@/features/customers/property-draft";
import { useI18n } from "@/lib/i18n";

type Props = {
  value: PropertyDraft;
  onChange: (value: PropertyDraft) => void;
};

export function PropertyFields({ value, onChange }: Props) {
  const { t } = useI18n();

  function update<K extends keyof PropertyDraft>(key: K, next: PropertyDraft[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label={t("property.label")}>
        <Input
          value={value.label}
          onChange={(event) => update("label", event.target.value)}
          placeholder={t("property.label")}
        />
      </Field>

      <Field label={t("property.address")}>
        <Input
          value={value.address_line1}
          onChange={(event) => update("address_line1", event.target.value)}
          required
        />
      </Field>

      <Field label={t("property.address2")}>
        <Input
          value={value.address_line2}
          onChange={(event) => update("address_line2", event.target.value)}
        />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label={t("property.city")}>
          <Input value={value.city} onChange={(event) => update("city", event.target.value)} />
        </Field>
        <Field label={t("property.state")}>
          <Input value={value.state} onChange={(event) => update("state", event.target.value)} />
        </Field>
        <Field label={t("property.zip")}>
          <Input
            value={value.postal_code}
            onChange={(event) => update("postal_code", event.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t("property.bedrooms")}>
          <Input
            type="number"
            min={0}
            value={value.bedrooms}
            onChange={(event) => update("bedrooms", event.target.value)}
          />
        </Field>
        <Field label={t("property.bathrooms")}>
          <Input
            type="number"
            min={0}
            value={value.bathrooms}
            onChange={(event) => update("bathrooms", event.target.value)}
          />
        </Field>
      </div>

      <Field label={t("property.accessNotes")}>
        <Textarea
          value={value.access_notes}
          onChange={(event) => update("access_notes", event.target.value)}
        />
      </Field>

      <Field label={t("property.parkingNotes")}>
        <Input
          value={value.parking_notes}
          onChange={(event) => update("parking_notes", event.target.value)}
        />
      </Field>
    </div>
  );
}
