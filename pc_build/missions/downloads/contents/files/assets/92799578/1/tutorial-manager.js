class TutorialManager extends pc.ScriptType {
    initialize() {
        this.app.on("TutorialManager:cursorTap", this._cursorTap, this);
        this.app.on("TutorialManager:actionDone", this._actionDone, this);

        this.value = { value: 0 };
        this.startPivot = new pc.Vec2(0.5, 0.5);
        this.finalPivot = new pc.Vec2(1, 0);
        this.lerpPivot = new pc.Vec2();
        const stateScript = this.app.root.children[0].script.GlobalState;
        this.mainCamera = stateScript.mainCamera;

        this.currentTween = null;
        this.entityToFollow = null;
        this.isUiCoord = false;
        this.fingerEntity = this.cursor.children[0];

        this.cursorTapTween = this.app.tween(this.value)
            .to({ value: 1 }, 1, pc.QuadraticOut)
            .loop(true)
            .yoyo(true)
            .on("update", () => {
                this.lerpPivot.lerp(this.startPivot, this.finalPivot, this.value.value);
                this.fingerEntity.element.pivot = this.lerpPivot;
                this.fingerEntity.element.opacity = this.value.value;
            });

        gp.on("resize", this.resize, this);
    }

    resize() {
        if (this.entityToFollow) {
            const screenCoords = this._cursorPosition(this.entityToFollow, this.isUiCoord);
            const screenWidth = gp.size.width;
            const screenHeight = gp.size.height;

            const newAnchor = new pc.Vec4(screenCoords.x / screenWidth, 1 - screenCoords.y / screenHeight, screenCoords.x / screenWidth, 1 - screenCoords.y / screenHeight);
            this.cursor.element.anchor = newAnchor;
        }
    }

    _actionDone() {
        if (this.currentTween) {
            this.cursor.enabled = false;
            this.currentTween.stop();
            this.entityToFollow = null;
            this.isUiCoord = false;
            this.currentTween = null;
        }
    }

    _cursorTap(entityToFollow, isUiCoord) {
        this.cursor.enabled = true;
        this.entityToFollow = entityToFollow;
        this.isUiCoord = isUiCoord;
        this.value.value = 0;

        const screenCoords = this._cursorPosition(this.entityToFollow, this.isUiCoord);
        const screenWidth = gp.size.width;
        const screenHeight = gp.size.height;

        const newAnchor = new pc.Vec4(screenCoords.x / screenWidth, 1 - screenCoords.y / screenHeight, screenCoords.x / screenWidth, 1 - screenCoords.y / screenHeight);
        this.cursor.element.anchor = newAnchor;

        if (this.currentTween === null) {
            this.currentTween = this.cursorTapTween.start();
        }
    }

    _cursorPosition(entityToFollow, isUiCoord) {
        if (isUiCoord) {
            const corners = entityToFollow.element.canvasCorners;

            return new pc.Vec2().sub2(corners[2], corners[0]).mulScalar(0.5).add(corners[0]);
        }

        return this.mainCamera.camera.worldToScreen(entityToFollow.getPosition());
    }
}

pc.registerScript(TutorialManager);

TutorialManager.attributes.add("cursor", { type: "entity" });
