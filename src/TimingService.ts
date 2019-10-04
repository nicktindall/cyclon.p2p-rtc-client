export class TimingService {

    getCurrentTimeInMilliseconds(): number {
        return new Date().getTime();
    }
}
