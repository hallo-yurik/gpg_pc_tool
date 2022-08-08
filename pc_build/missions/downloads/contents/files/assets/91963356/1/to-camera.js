class ToCamera extends pc.ScriptType {
    initialize() {
        this.stateScript = this.app.root.children[0].script.GlobalState;
        this.camera = this.stateScript.mainCamera;
    }

    update() {
        const cameraRotation = this.camera.getRotation();
        this.entity.setRotation(cameraRotation);
    }
}

pc.registerScript(ToCamera);