import { _decorator, Component } from 'cc';

const { ccclass } = _decorator;

/**
 * Marker on the finish prefab root. GameFlow detects win via UITransform overlap with the player.
 * Hazards must not include this component.
 */
@ccclass('FinishZone')
export class FinishZone extends Component {}
