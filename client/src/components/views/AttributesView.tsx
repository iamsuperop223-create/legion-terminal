import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { Card } from "@/components/ui/Card";
import { Trash2 } from "lucide-react";

const VALUE_TYPES = ["text", "number", "boolean", "select", "scale"];

export default function AttributesView() {
  const { attributes, createAttribute, updateAttribute, deleteAttribute } = useAppStore();
  const [draft, setDraft] = useState({ name: "", category: "order-flow", valueType: "text", options: "" });

  const addAttribute = async () => {
    if (!draft.name.trim()) return;
    const data: any = {
      name: draft.name.trim(),
      category: draft.category,
      valueType: draft.valueType,
    };
    if (draft.valueType === "select") {
      data.options = draft.options.split(",").map((s) => s.trim()).filter(Boolean);
    }
    await createAttribute(data);
    setDraft({ name: "", category: "order-flow", valueType: "text", options: "" });
  };

  const categories = [...new Set(attributes.map((a) => a.category))];

  return (
    <div className="p-5 flex flex-col gap-4">
      <Card className="p-4">
        <div className="text-xs text-textFaint uppercase tracking-wider mb-1.5">Custom attributes</div>
        <div className="text-xs text-textFaint mb-3.5">
          Any field you want to track on a trade — order-flow context, psychology, checklist items — lives here.
          Define it once, it becomes available on every trade and as a grouping dimension in Statistics.
        </div>

        {categories.map((cat) => (
          <div key={cat} className="mb-3.5">
            <div className="text-[11px] text-gold uppercase tracking-wider mb-2">{cat}</div>
            <div className="flex flex-col gap-2">
              {attributes.filter((a) => a.category === cat).map((a) => (
                <div key={a.id} className="flex items-center justify-between px-3.5 py-2.5 bg-surface2 rounded-lg">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={a.active}
                      onChange={() => updateAttribute(a.id, { active: !a.active })}
                      className="accent-gold"
                    />
                    <div>
                      <div className="text-sm font-semibold">{a.name}</div>
                      <div className="text-[11px] text-textFaint">
                        {a.valueType}{a.options?.length ? ` · ${a.options.join(", ")}` : ""}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => deleteAttribute(a.id)} className="text-textDim hover:text-accent-red transition">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex gap-2 flex-wrap mt-2 pt-3.5 border-t border-border">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Attribute name"
            className="bg-surface2 border border-border rounded-lg px-3 py-2 text-text text-sm w-56"
          />
          <input
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            placeholder="category"
            className="bg-surface2 border border-border rounded-lg px-3 py-2 text-text text-sm w-32"
          />
          <select
            value={draft.valueType}
            onChange={(e) => setDraft({ ...draft, valueType: e.target.value })}
            className="bg-surface2 border border-border rounded-lg px-3 py-2 text-text text-sm"
          >
            {VALUE_TYPES.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          {draft.valueType === "select" && (
            <input
              value={draft.options}
              onChange={(e) => setDraft({ ...draft, options: e.target.value })}
              placeholder="comma,separated,options"
              className="bg-surface2 border border-border rounded-lg px-3 py-2 text-text text-sm w-56"
            />
          )}
          <button onClick={addAttribute} className="bg-gold text-[#1A1206] font-bold text-sm px-4 py-2 rounded-lg hover:opacity-90 transition">
            Add attribute
          </button>
        </div>
      </Card>
    </div>
  );
}
