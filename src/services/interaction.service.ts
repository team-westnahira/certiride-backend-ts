import { VehicleBlockChainModel } from "../models/vehicle.model";


export const isInteractionExists = async (interactionId: string, vehicle: VehicleBlockChainModel) => {
    const interactionExists = vehicle.interaction.some(interaction => interaction.interaction_id === interactionId)

    if (!interactionExists) {
        return false
    }

    return true
}


export const getInteraction = async (interacionId: string , vehicle: VehicleBlockChainModel) => {
    const interaction = vehicle.interaction.find(interaction => interaction.interaction_id === interacionId)

    if (!interaction) {
        return null
    }

    return interaction
}

export const getLatestInteraction = async (vehicle: VehicleBlockChainModel) => {
    const latestInteraction = vehicle.interaction[vehicle.interaction.length - 1]

    if (!latestInteraction) {
        return null
    }

    return latestInteraction
}