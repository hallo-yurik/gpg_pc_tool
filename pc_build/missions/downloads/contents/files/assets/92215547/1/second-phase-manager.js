class SecondPhaseManager extends pc.ScriptType {
    initialize() {
        this.DETAILS_AMOUNT = 4;
        this.detailsCounter = 0;
        this.isMoving = false;
        this.imageCounter = 0;
        this.phaseIsOn = false;
        this.counter = 0;

        this.autoclickTimeout = 0;
        this.AUTOCLICK_TIME = 6;
        this.dontShowTimeout = 0;
        this.DONT_SHOW_TIME = 4;

        this.details = [
            {
                entity: [this.cabin],
                offset: [new pc.Vec3(0, 0, 1)]
            },
            {
                entity: [this.tail],
                offset: [new pc.Vec3(0, 0, -1)]
            },
            {
                entity: this.wings,
                offset: [new pc.Vec3(1, 0, 0), new pc.Vec3(-1, 0, 0)]
            },
            {
                entity: this.turbins,
                offset: [new pc.Vec3(1, 0, 1), new pc.Vec3(-1, 0, 1)]
            }
        ];

        this.app.on("SecondPhaseManager:startPhase", this.startPhase, this);
        this.app.on("SecondPhaseManager:showPopup", this.showPopup, this);
        this.uiButton.element.on("click", this.addNextDetail, this);
        this.uiCenterButton.element.on("click", this.addNextDetail, this);
    }

    startPhase() {
        this._distruckPlane();
        this.uiButton.parent.enabled = true;
        this.uiCenterButton.enabled = true;
        this.uiBanner.enabled = true;
        this.planeImage.element.texture = this.imagesSet[0].resource;
        const textureResolution = this.imagesSet[0].resource.width / this.imagesSet[0].resource.height;
        this.planeImage.element.width = this.planeImage.element.height * textureResolution;
        this.textCounter.element.text = `${0} / ${this.DETAILS_AMOUNT}`;

        this.phaseIsOn = true;

        this.uiButton.script.ButtonFill.incrementCount = this.DETAILS_AMOUNT;
    }

    async addNextDetail() {
        if (this.detailsCounter === this.DETAILS_AMOUNT) return;
        if (this.isMoving) return;

        this.isMoving = true;
        this.uiButton.fire("increment");

        this.autoclickTimeout = 0;
        this.dontShowTimeout = 0;
        this.showCursor = false;
        this.app.fire("TutorialManager:actionDone");

        await this.assembleDetail();

        this.detailsCounter++;

        if (this.detailsCounter === this.DETAILS_AMOUNT) {
            this._finishPhase();
        }

        this.textCounter.element.text = `${this.detailsCounter} / ${this.DETAILS_AMOUNT}`;

        this.isMoving = false;
    }

    async assembleDetail() {
        const ladleDetail = this.ladleDetails[this.detailsCounter];
        const planeDetail = this.details[this.detailsCounter];

        const startScaleCoefficient = 1;
        const startLadleDetailLocalScale = ladleDetail.getLocalScale().clone();
        const planeScaleCoefficient = planeDetail.entity[0].getWorldTransform().getScale().clone().div(ladleDetail.getWorldTransform().getScale()).x;
        const lerpScale = new pc.Vec3();

        const ladlePartPosition = ladleDetail.getPosition().clone();
        const planePartPosition = planeDetail.entity[0].getPosition();
        const lerpPosition = new pc.Vec3();

        const ladlePartQuat = ladleDetail.getRotation().clone();
        const planePartQuat = planeDetail.entity[0].getRotation();
        const lerpQuat = new pc.Quat();

        const value = { value: 0 };

        await new Promise(res => {
            this.app.tween(value)
                .to({ value: 1 }, 0.2, pc.Linear)
                .on("update", () => {
                    const lerpScaleCoefficient = pc.math.lerp(startScaleCoefficient, planeScaleCoefficient, value.value);
                    lerpScale.copy(startLadleDetailLocalScale).mulScalar(lerpScaleCoefficient);
                    lerpPosition.lerp(ladlePartPosition, planePartPosition, value.value);
                    lerpQuat.slerp(ladlePartQuat, planePartQuat, value.value);

                    ladleDetail.setLocalScale(lerpScale);
                    ladleDetail.setPosition(lerpPosition);
                    ladleDetail.setRotation(lerpQuat);
                })
                .on("complete", () => {
                    this.particles.particlesystem.reset();
                    this.particles.particlesystem.play();
                    ladleDetail.enabled = false;
                    res();
                })
                .start();
        });

        planeDetail.entity.forEach(detail => detail.enabled = true);
    }

    async _finishPhase() {
        // Remove buttons.
        this.uiButton.parent.enabled = false;
        this.uiCenterButton.enabled = false;
        this.phaseIsOn = false;
        this.uiBanner.enabled = false;

        // Asemble plane.
        const value = { value: 0 };

        const startPositions = this.details.map(detail => detail.entity.map(entity => entity.getPosition()));
        const finalPositions = this.details.map(detail => detail.entity.map((entity, index) => entity.getPosition().clone().sub(detail.offset[index])));
        const lerpPosition = new pc.Vec3();

        await new Promise(res => {
            this.app.tween(value)
                .to({ value: 1 }, 1, pc.Linear)
                .on("update", () => {
                    for (let i = 0; i < this.details.length; i++) {
                        const detail = this.details[i];

                        for (let j = 0; j < detail.entity.length; j++) {
                            const startPosition = startPositions[i][j];
                            const finalPosition = finalPositions[i][j];

                            lerpPosition.lerp(startPosition, finalPosition, value.value);

                            const entity = detail.entity[j];

                            entity.setPosition(lerpPosition);
                        }
                    }
                })
                .on("complete", () => {
                    value.value = 0;
                    res();
                })
                .start();
        });

        await this._movePlainToRunway();

        this.finalBanner.enabled = true;
    }

    _distruckPlane() {
        for (const detailData of this.details) {
            for (let i = 0; i < detailData.entity.length; i++) {
                detailData.entity[i].translate(detailData.offset[i]);
            }
        }
    }

    async _movePlainToRunway() {
        const plane = this.cabin.parent;

        const stateScript = this.app.root.children[0].script.GlobalState;
        const camera = stateScript.mainCamera;
        const value = { value: 0 };
        const startZ = plane.getPosition().z;
        const finishZ = 23;

        let lastZ = startZ;

        await new Promise(res => {
            this.app.tween(value)
                .to({ value: 1 }, 2, pc.Linear)
                .on("update", () => {
                    const lerpZ = pc.math.lerp(startZ, finishZ, value.value);
                    const zOffset = lerpZ - lastZ;
                    lastZ = lerpZ;

                    plane.setPosition(0, 0, lerpZ);
                    camera.translate(0, 0, zOffset);
                })
                .on("complete", () => {
                    value.value = 0;
                    res();
                })
                .start();
        });

        const startRotation = camera.getRotation().clone();
        const newRotation = this.helpCamera.getRotation();
        const lerpRotation = new pc.Quat();

        const startPosition = camera.getPosition().clone();
        const endPosition = this.helpCamera.getPosition();
        const lerpPosition = new pc.Vec3();

        await new Promise(res => {
            this.app.tween(value)
                .to({ value: 1 }, 0.5, pc.Linear)
                .on("update", () => {
                    lerpRotation.slerp(startRotation, newRotation, value.value);
                    lerpPosition.lerp(startPosition, endPosition, value.value);

                    camera.setRotation(lerpRotation);
                    camera.setPosition(lerpPosition);
                })
                .on("complete", () => {
                    res();
                })
                .start();
        });

        this.showPopup();
    }

    showPopup() {
        if (this.thirdPhaseButton.enabled) return;

        this.thirdPhaseButton.enabled = true;

        gp.finish();

        if (this.app.touch) {
            this.app.touch.on(pc.EVENT_TOUCHSTART, () => {
                gp.install();
            });
        }

        if (this.app.mouse) {
            this.app.mouse.on(pc.EVENT_MOUSEDOWN, () => {
                gp.install();
            });
        }
    }

    update(dt) {
        if (this.phaseIsOn) {
            this.counter++;

            if (this.counter === 19) {
                this.counter = 0;

                this.imageCounter++;
                this.imageCounter %= 3;

                this.planeImage.element.texture = this.imagesSet[this.imageCounter].resource;
                const textureResolution = this.imagesSet[this.imageCounter].resource.width / this.imagesSet[this.imageCounter].resource.height;
                this.planeImage.element.width = this.planeImage.element.height * textureResolution;
            }

            // Tutorial.
            if (this.showCursor) {
                this.autoclickTimeout += dt;

                if (this.autoclickTimeout > this.AUTOCLICK_TIME) {
                    this.addNextDetail();
                }
            } else {
                this.dontShowTimeout += dt;

                if (this.dontShowTimeout > this.DONT_SHOW_TIME) {
                    this.app.fire("TutorialManager:cursorTap", this.uiCenterButton, true);
                    this.dontShowTimeout = 0;
                    this.autoclickTimeout = 0;
                    this.showCursor = true;
                }
            }
        }
    }
}

pc.registerScript(SecondPhaseManager);

SecondPhaseManager.attributes.add("cabin", { type: "entity" });
SecondPhaseManager.attributes.add("tail", { type: "entity" });
SecondPhaseManager.attributes.add("wings", { type: "entity", array: true });
SecondPhaseManager.attributes.add("turbins", { type: "entity", array: true });
SecondPhaseManager.attributes.add("ladleDetails", { type: "entity", array: true });
SecondPhaseManager.attributes.add("uiButton", { type: "entity" });
SecondPhaseManager.attributes.add("uiCenterButton", { type: "entity" });
SecondPhaseManager.attributes.add("helpCamera", { type: "entity" });
SecondPhaseManager.attributes.add("thirdPhaseButton", { type: "entity" });
SecondPhaseManager.attributes.add("particles", { type: "entity" });
SecondPhaseManager.attributes.add("uiBanner", { type: "entity" });
SecondPhaseManager.attributes.add("finalBanner", { type: "entity" });
SecondPhaseManager.attributes.add("planeImage", { type: "entity" });
SecondPhaseManager.attributes.add("textCounter", { type: "entity" });
SecondPhaseManager.attributes.add("imagesSet", { type: "asset", assetType: "texture", array: true });
