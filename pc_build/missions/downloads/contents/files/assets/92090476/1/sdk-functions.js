class SdkFunctions extends pc.ScriptType {
    initialize() {
        gp.render();

        window.game.showPopup = () => {
            this.app.fire("SecondPhaseManager:showPopup");
        };
    }
}

pc.registerScript(SdkFunctions);
