class GlobalState extends pc.ScriptType {
    initialize() {
    }
}

pc.registerScript(GlobalState);

GlobalState.attributes.add("mainCamera", { type: "entity" });