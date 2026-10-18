import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import RecoveryEnginePlugin from "../main";
import { ItemDetailsModal } from "./item-details-modal";
import { EditItemModal } from "../modals/edit-item-modal";

export const ITEMS_VIEW_TYPE = "recovery-engine-items";

export class ItemsView extends ItemView {
  private q = "";
  private subjectFilter = "";
  private statusFilter: "all" | "active" | "archived" | "trash" = "active";
  private sort: "newest" | "oldest" | "due" = "newest";
  constructor(leaf: WorkspaceLeaf, private plugin: RecoveryEnginePlugin) { super(leaf); }
  getViewType() { return ITEMS_VIEW_TYPE; }
  getDisplayText() { return "همهٔ مطالب"; }
  getIcon() { return "list"; }
  async onOpen() { this.render(); }
  refresh() { this.render(); }

  private async render() {
    const c = this.containerEl.children[1] as HTMLElement;
    c.empty(); c.addClass("recovery-engine-dashboard"); c.setAttr("dir", "rtl");
    c.createEl("h2", { text: "همهٔ مطالب" });

    const bar = c.createDiv({ cls: "re-filter-bar" });
    const search = bar.createEl("input", { type: "text", placeholder: "جست‌وجو..." });
    search.value = this.q;
    search.oninput = () => { this.q = search.value; this.renderList(listEl); };

    const subj = bar.createEl("select");
    subj.createEl("option", { value: "", text: "همهٔ درس‌ها" });
    this.plugin.settings.subjects.forEach((s) => subj.createEl("option", { value: s.id, text: s.name }));
    subj.value = this.subjectFilter;
    subj.onchange = () => { this.subjectFilter = subj.value; this.renderList(listEl); };

    const status = bar.createEl("select");
    [["active","فعال"],["archived","بایگانی"],["trash","سطل زباله"],["all","همه"]].forEach(([v,t]) => status.createEl("option", { value: v, text: t }));
    status.value = this.statusFilter;
    status.onchange = () => { this.statusFilter = status.value as unknown; this.renderList(listEl); };

    const sortSel = bar.createEl("select");
    [["newest","جدیدترین"],["oldest","قدیمی‌ترین"],["due","نزدیک‌ترین موعد"]].forEach(([v,t]) => sortSel.createEl("option", { value: v, text: t }));
    sortSel.value = this.sort;
    sortSel.onchange = () => { this.sort = sortSel.value as unknown; this.renderList(listEl); };

    const listEl = c.createDiv();
    await this.renderList(listEl);
  }

  private async renderList(listEl: HTMLElement) {
    listEl.empty();
    const all = await this.plugin.getItems();
    const q = this.q.trim().toLowerCase();
    const filtered = all.filter((i) => {
      if (this.statusFilter === "active" && (i.archived || i.deleted)) return false;
      if (this.statusFilter === "archived" && !i.archived) return false;
      if (this.statusFilter === "trash" && !i.deleted) return false;
      if (this.subjectFilter && i.subjectId !== this.subjectFilter) return false;
      if (q) {
        const hay = [i.title, i.source, i.rangeFrom, i.rangeTo, i.notes, ...Object.values(i.customFields ?? {})].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    filtered.sort((a, b) => {
      if (this.sort === "newest") return b.learnedAt.localeCompare(a.learnedAt);
      if (this.sort === "oldest") return a.learnedAt.localeCompare(b.learnedAt);
      // due: نزدیک‌ترین مرور انجام‌نشده
      const ad = a.reviews.filter(r => !r.completed).map(r => r.dueDate).sort()[0] ?? "9999";
      const bd = b.reviews.filter(r => !r.completed).map(r => r.dueDate).sort()[0] ?? "9999";
      return ad.localeCompare(bd);
    });

    listEl.createEl("p", { text: `${filtered.length} مطلب`, cls: "re-empty" });
    if (filtered.length === 0) return;

    const table = listEl.createEl("table", { cls: "re-table" });
    const head = table.createEl("tr");
    ["درس", "عنوان", "تاریخ یادگیری", "انجام‌شده", "باقی‌مانده", "عملیات"].forEach((h) => head.createEl("th", { text: h }));

    for (const item of filtered) {
      const subject = this.plugin.settings.subjects.find((s) => s.id === item.subjectId);
      const done = item.reviews.filter((r) => r.completed).length;
      const remain = item.reviews.length - done;
      const tr = table.createEl("tr");
      tr.createEl("td", { text: subject?.name ?? "—" });
      const titleCell = tr.createEl("td", { text: item.title });
      titleCell.setCssStyles({ cursor: "pointer" });
      titleCell.onclick = () => new ItemDetailsModal(this.app, this.plugin, item, () => this.render()).open();
      tr.createEl("td", { text: item.learnedAt });
      tr.createEl("td", { text: String(done) });
      tr.createEl("td", { text: String(remain) });

      const ops = tr.createEl("td");
      if (!item.deleted) {
        const edit = ops.createEl("button", { text: "ویرایش" });
        edit.onclick = () => new EditItemModal(this.app, this.plugin, item, () => this.render()).open();
        if (item.archived) {
          const un = ops.createEl("button", { text: "خروج از بایگانی" });
          un.onclick = async () => { item.archived = false; await this.plugin.saveItem(item); this.render(); };
        } else {
          const ar = ops.createEl("button", { text: "بایگانی" });
          ar.onclick = async () => { item.archived = true; await this.plugin.saveItem(item); this.render(); };
        }
        const del = ops.createEl("button", { text: "حذف" });
        del.onclick = async () => {
          if (this.plugin.settings.requireConfirmOnDelete && !confirm(`«${item.title}» به سطل زباله برود؟`)) return;
          item.deleted = true; item.deletedAt = new Date().toISOString();
          await this.plugin.saveItem(item); this.render();
        };
      } else {
        const restore = ops.createEl("button", { text: "بازیابی" });
        restore.onclick = async () => { item.deleted = false; item.deletedAt = null; await this.plugin.saveItem(item); this.render(); };
        const purge = ops.createEl("button", { text: "حذف دائمی" });
        purge.onclick = async () => {
          if (!confirm(`حذف دائمی «${item.title}»؟`)) return;
          await this.plugin.removeItemPermanently(item.id); this.render();
        };
      }
    }
  }
}
